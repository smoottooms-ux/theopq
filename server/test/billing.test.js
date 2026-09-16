/**
 * Entitlements, quotas and the operator escape hatch.
 *
 * These paths decide who gets to spend the operator's provider credit, so they
 * are tested without any provider configured — the point is the gate, not the
 * voice.
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'nightshift-billing-'));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'test-admin-token';
delete process.env.ELEVENLABS_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

const { app } = await import('../dist/index.js');

let server;
let base;
let token;
let childId;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  const signup = await post('/auth/signup', { name: 'Dad', email: 'dad@example.com', pin: '1234' });
  token = signup.body.token;

  const child = await post(
    '/children',
    { name: 'Maya', age: 6, avatar: '🦊', pin: '2468', bedtime: '19:30' },
    token,
  );
  childId = child.body.id;
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

async function call(path, options = {}) {
  const res = await fetch(base + path, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const post = (path, payload, bearer) =>
  call(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(payload),
  });

const get = (path, bearer) =>
  call(path, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });

test('a new family lands on a free trial', async () => {
  const { status, body } = await get('/account', token);
  assert.equal(status, 200);
  assert.equal(body.entitlement.plan, 'trial');
  assert.equal(body.entitlement.status, 'active');
  assert.equal(body.entitlement.stories.used, 0);
  assert.ok(body.entitlement.stories.limit > 0);
});

test('the account reports which capabilities the server actually has', async () => {
  const { body } = await get('/account', token);
  // No provider keys in this test environment, so both must report false
  // rather than promising something the server cannot deliver.
  assert.equal(body.capabilities.voiceCloning, false);
  assert.equal(body.capabilities.bespokeStories, false);
});

test('composing a story consumes exactly one story from the quota', async () => {
  const before = (await get('/account', token)).body.entitlement.stories.used;

  const { status } = await post(
    '/stories/compose',
    {
      story: {
        id: 'story_quota_1',
        toChildId: childId,
        title: 'A Test Story',
        pages: [{ text: 'Once upon a time.', art: 'moon' }],
        scheduledFor: Date.now(),
      },
    },
    token,
  );
  assert.equal(status, 201);

  const after = (await get('/account', token)).body.entitlement.stories.used;
  assert.equal(after, before + 1);
});

test('a story composed without a cloned voice still gets delivered', async () => {
  const { body } = await get('/stories?childId=' + childId, token);
  const story = body.find((s) => s.id === 'story_quota_1');
  assert.ok(story, 'the story reached the library');
  assert.equal(story.audioUrl, null, 'no narration, because no voice is enrolled');
  assert.equal(story.voiceProvider, 'device', 'and it is labelled honestly');
});

test('voice enrollment refuses when the server has no provider configured', async () => {
  const { status, body } = await post(
    '/voice/enroll',
    { sampleIds: ['a', 'b', 'c'], consentName: 'Dad', parentName: 'Dad' },
    token,
  );
  assert.equal(status, 503);
  assert.match(body.error, /not available/i);
});

test('enrollment rejects consent that does not match the account name', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-key-not-used';
  const { status, body } = await post(
    '/voice/enroll',
    { sampleIds: ['a', 'b', 'c'], consentName: 'Someone Else', parentName: 'Dad' },
    token,
  );
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal(status, 400);
  assert.match(body.error, /consent/i);
});

test('running out of trial stories returns a payment-required upgrade prompt', async () => {
  // Burn the remaining allowance.
  for (let i = 0; i < 20; i++) {
    const res = await post(
      '/stories/compose',
      {
        story: {
          id: `story_burn_${i}`,
          toChildId: childId,
          title: 'Burn',
          pages: [{ text: 'x', art: 'moon' }],
          scheduledFor: Date.now(),
        },
      },
      token,
    );
    if (res.status === 402) {
      assert.match(res.body.error, /stories/i);
      assert.equal(res.body.upgrade, true);
      return;
    }
  }
  assert.fail('the quota never ran out');
});

test('the admin token can grant a paid plan', async () => {
  const { status, body } = await call('/admin/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'test-admin-token' },
    body: JSON.stringify({ email: 'dad@example.com', plan: 'family' }),
  });
  assert.equal(status, 200);
  assert.equal(body.plan, 'family');
  assert.equal(body.stories.used, 0, 'upgrading resets the usage window');
});

test('a bad admin token is refused', async () => {
  const { status } = await call('/admin/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'wrong-token-here' },
    body: JSON.stringify({ email: 'dad@example.com', plan: 'lifetime' }),
  });
  assert.equal(status, 401);
});

test('an upgraded family can compose again', async () => {
  const { status } = await post(
    '/stories/compose',
    {
      story: {
        id: 'story_after_upgrade',
        toChildId: childId,
        title: 'After Upgrade',
        pages: [{ text: 'Once more.', art: 'moon' }],
        scheduledFor: Date.now(),
      },
    },
    token,
  );
  assert.equal(status, 201);
});

test('the family journal records what happened', async () => {
  const { status, body } = await get('/activity', token);
  assert.equal(status, 200);

  const kinds = body.map((entry) => entry.kind);
  assert.ok(kinds.includes('child_added'), 'adding a child is journalled');
  assert.ok(kinds.includes('story_sent'), 'sending a story is journalled');
  assert.ok(kinds.includes('plan_changed'), 'plan changes are journalled');

  // Newest first, so the archive can be paged backwards through time.
  for (let i = 1; i < body.length; i++) {
    assert.ok(body[i - 1].createdAt >= body[i].createdAt);
  }
});

test('the journal is scoped to one family', async () => {
  const other = await post('/auth/signup', {
    name: 'Stranger',
    email: 'other@example.com',
    pin: '1111',
  });
  const { body } = await get('/activity', other.body.token);
  assert.equal(body.length, 0, 'a new family sees nothing of anyone else');
});

test('checkout is refused cleanly when payments are not configured', async () => {
  const { status, body } = await post('/billing/checkout', { plan: 'family' }, token);
  assert.equal(status, 503);
  assert.match(body.error, /not switched on/i);
});

test('the plan list is public and marks what is purchasable', async () => {
  const { status, body } = await get('/billing/plans');
  assert.equal(status, 200);
  assert.equal(body.checkoutAvailable, false);
  assert.ok(body.plans.length >= 2);
  assert.ok(body.plans.every((p) => p.price > 0), 'only paid plans are advertised');
});

test('a webhook without a signature is rejected', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const { status } = await call('/billing/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'checkout.session.completed' }),
  });
  delete process.env.STRIPE_WEBHOOK_SECRET;
  assert.equal(status, 400);
});
