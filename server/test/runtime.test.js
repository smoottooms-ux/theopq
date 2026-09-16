/**
 * Operational surfaces: readiness, headers, and the startup gate.
 *
 * These are the things an orchestrator and an on-call human rely on, so they
 * are tested like anything else.
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'nightshift-runtime-'));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = 'test';

const { app } = await import('../dist/index.js');
const { inspectEnvironment } = await import('../dist/runtime.js');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

test('liveness responds without touching the database', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test('readiness reports which capabilities are actually configured', async () => {
  const res = await fetch(`${base}/ready`);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.ready, true);
  assert.equal(typeof body.uptimeSeconds, 'number');

  // No provider keys in the test environment, so it must not claim otherwise.
  assert.equal(body.capabilities.voiceCloning, false);
  assert.equal(body.capabilities.bespokeStories, false);
  assert.equal(body.capabilities.checkout, false);
});

test('security headers are set on every response', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-powered-by'), null, 'Express does not announce itself');
});

test('a Stripe key without a webhook secret is treated as fatal', () => {
  const before = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_live_whatever';
  delete process.env.STRIPE_WEBHOOK_SECRET;

  const fatal = inspectEnvironment().filter((w) => w.level === 'fatal');
  assert.ok(
    fatal.some((w) => /WEBHOOK_SECRET/.test(w.message)),
    'taking money with no way to hear about it must be fatal',
  );

  if (before === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = before;
});

test('a missing voice key is a warning, not a failure', () => {
  const warnings = inspectEnvironment();
  const voice = warnings.find((w) => /ELEVENLABS_API_KEY/.test(w.message));
  assert.ok(voice, 'the operator is told');
  assert.equal(voice.level, 'warn', 'but the server still serves stories without it');
});
