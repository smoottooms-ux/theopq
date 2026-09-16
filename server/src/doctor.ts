/**
 * Pre-flight check.
 *
 *   npm run doctor
 *
 * Validates the environment and actually calls the providers, so a broken key
 * or an empty account is discovered now rather than by a child at bedtime.
 * Exits non-zero if anything would stop the product working, which makes it
 * usable as a deploy gate.
 */

import { accessSync, constants, mkdirSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectEnvironment } from './runtime.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let failures = 0;
let warnings = 0;

function pass(label: string, detail?: string): void {
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? ` ${DIM}${detail}${RESET}` : ''}`);
}

function warn(label: string, detail: string): void {
  warnings++;
  console.log(`  ${YELLOW}!${RESET} ${label}\n    ${DIM}${detail}${RESET}`);
}

function fail(label: string, detail: string): void {
  failures++;
  console.log(`  ${RED}✗${RESET} ${label}\n    ${DIM}${detail}${RESET}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

async function checkStorage(): Promise<void> {
  section('Storage');
  const dir = resolve(process.env.DATA_DIR ?? './data');

  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    pass('Data directory is writable', dir);
  } catch (err) {
    fail('Data directory is not writable', `${dir} — ${(err as Error).message}`);
    return;
  }

  try {
    const stats = statfsSync(dir);
    const freeGb = (stats.bavail * stats.bsize) / 1e9;
    // Audio is the thing that grows: a few MB per story, kept forever.
    if (freeGb < 1) fail('Almost no disk space left', `${freeGb.toFixed(2)} GB free`);
    else if (freeGb < 5) warn('Disk space is getting low', `${freeGb.toFixed(1)} GB free`);
    else pass('Disk space', `${freeGb.toFixed(1)} GB free`);
  } catch {
    // statfs is not available everywhere; not worth failing over.
  }
}

async function checkElevenLabs(): Promise<void> {
  section('Voice cloning (ElevenLabs)');
  const key = process.env.ELEVENLABS_API_KEY?.trim();

  if (!key) {
    warn(
      'No ELEVENLABS_API_KEY',
      'The app still works — stories are read by the child\'s device and labelled honestly — but nobody gets a cloned voice. This is the main thing customers pay for.',
    );
    return;
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': key },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 401) {
      fail('API key rejected', 'ElevenLabs returned 401. Check the key is current and complete.');
      return;
    }
    if (!res.ok) {
      fail('Could not reach ElevenLabs', `HTTP ${res.status}`);
      return;
    }

    const body = (await res.json()) as {
      tier?: string;
      character_count?: number;
      character_limit?: number;
      can_use_instant_voice_cloning?: boolean;
    };

    pass('API key works', `tier: ${body.tier ?? 'unknown'}`);

    const used = body.character_count ?? 0;
    const limit = body.character_limit ?? 0;
    if (limit > 0) {
      const remaining = limit - used;
      // A full-length story is roughly 4,000 characters of narration.
      const stories = Math.floor(remaining / 4000);
      if (remaining <= 0) {
        fail('Character quota exhausted', 'Narration will fail until the quota resets or is topped up.');
      } else if (stories < 25) {
        warn(
          'Character quota is low',
          `${remaining.toLocaleString()} characters left — roughly ${stories} more stories.`,
        );
      } else {
        pass(
          'Character quota',
          `${remaining.toLocaleString()} left — roughly ${stories} stories`,
        );
      }
    }

    if (body.can_use_instant_voice_cloning === false) {
      fail(
        'This plan cannot clone voices',
        'Instant Voice Cloning is not enabled on this ElevenLabs plan. Voice enrollment will fail for every customer.',
      );
    } else if (body.can_use_instant_voice_cloning) {
      pass('Instant voice cloning is enabled');
    }
  } catch (err) {
    fail('Could not reach ElevenLabs', (err as Error).message);
  }
}

async function checkAnthropic(): Promise<void> {
  section('Story writing (Anthropic)');
  const key = process.env.ANTHROPIC_API_KEY?.trim();

  if (!key) {
    warn(
      'No ANTHROPIC_API_KEY',
      'The built-in story engine will be used. That produces real stories offline, so this is optional.',
    );
    return;
  }

  try {
    // A one-token request is the cheapest way to prove the key is live.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (res.status === 401) {
      fail('API key rejected', 'Anthropic returned 401. Check the key.');
      return;
    }
    if (res.status === 400) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      fail('Request rejected', body.error?.message ?? 'HTTP 400');
      return;
    }
    if (!res.ok) {
      fail('Could not reach Anthropic', `HTTP ${res.status}`);
      return;
    }

    pass('API key works', 'claude-opus-5 reachable');
  } catch (err) {
    fail('Could not reach Anthropic', (err as Error).message);
  }
}

function checkBilling(): void {
  section('Billing');
  const stripe = process.env.STRIPE_SECRET_KEY?.trim();

  if (!stripe) {
    warn(
      'Stripe is not configured',
      'Nobody can self-serve a subscription. Grant plans by hand with ADMIN_TOKEN until you switch this on — that is a fine way to run your first customers.',
    );
  } else {
    pass('Stripe key present', stripe.startsWith('sk_test_') ? 'TEST mode' : 'live mode');
    const prices = ['STRIPE_PRICE_FAMILY', 'STRIPE_PRICE_FAMILY_ANNUAL', 'STRIPE_PRICE_LIFETIME']
      .filter((key) => process.env[key]?.trim());
    if (prices.length === 0) {
      fail('No STRIPE_PRICE_* ids set', 'Checkout is on but there is nothing to buy.');
    } else {
      pass(`${prices.length} plan${prices.length === 1 ? '' : 's'} purchasable`, prices.join(', '));
    }
  }

  if (process.env.ADMIN_TOKEN?.trim()) {
    const token = process.env.ADMIN_TOKEN.trim();
    if (token.length < 24) {
      fail('ADMIN_TOKEN is too short', 'Use at least 24 characters: openssl rand -hex 32');
    } else {
      pass('Admin token set', 'plans can be granted by hand');
    }
  }
}

function checkConfiguration(): void {
  section('Configuration');
  for (const warning of inspectEnvironment()) {
    if (warning.level === 'fatal') fail('Misconfiguration', warning.message);
    else if (warning.level === 'warn') warn('Check this', warning.message);
  }

  const cors = process.env.CORS_ORIGIN ?? '*';
  pass('CORS origin', cors);
  pass('Port', String(process.env.PORT ?? 8787));
  if (process.env.APP_URL) pass('App URL', process.env.APP_URL);
}

async function main(): Promise<void> {
  console.log('\nNightshift server — pre-flight check');
  console.log(DIM + '─'.repeat(52) + RESET);

  checkConfiguration();
  await checkStorage();
  await checkElevenLabs();
  await checkAnthropic();
  checkBilling();

  console.log(`\n${DIM}${'─'.repeat(52)}${RESET}`);

  if (failures > 0) {
    console.log(
      `${RED}${failures} problem${failures === 1 ? '' : 's'} that will break the product.${RESET}` +
        (warnings ? ` ${YELLOW}${warnings} warning${warnings === 1 ? '' : 's'}.${RESET}` : ''),
    );
    console.log('Fix the ✗ lines above, then run this again.\n');
    process.exit(1);
  }

  if (warnings > 0) {
    console.log(
      `${GREEN}Nothing is broken.${RESET} ${YELLOW}${warnings} thing${warnings === 1 ? '' : 's'} worth knowing about${RESET} — see the ! lines.\n`,
    );
    process.exit(0);
  }

  console.log(`${GREEN}Everything checks out. You are ready to take customers.${RESET}\n`);
}

void main();
