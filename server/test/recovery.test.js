/**
 * Passwords and security-question recovery.
 *
 * Recovery is the softest part of any account system, so these tests are about
 * what it refuses: weak passwords, one-right-one-wrong answers, enumeration of
 * which emails exist, and sessions surviving a reset.
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'nightshift-recovery-'));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = 'test';

const { app } = await import('../dist/index.js');

let server;
let base;

const PASSWORD = 'correct horse battery staple';
const QUESTIONS = [
  { question: 'What was the name of your first pet?', answer: 'Rufus' },
  { question: 'What street did you live on when you were eight?', answer: 'Maple Street' },
];

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

async function post(path, payload) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('signup requires a password worth having', async () => {
  const { status, body } = await post('/auth/signup', {
    name: 'Weak',
    email: 'weak@example.com',
    password: 'short',
    questions: QUESTIONS,
  });
  assert.equal(status, 400);
  assert.match(body.error, /8 characters/i);
});

test('signup rejects a famously guessed password', async () => {
  const { status, body } = await post('/auth/signup', {
    name: 'Weak',
    email: 'weak2@example.com',
    password: 'password',
    questions: QUESTIONS,
  });
  assert.equal(status, 400);
  assert.match(body.error, /guess/i);
});

test('signup requires two security questions', async () => {
  const { status, body } = await post('/auth/signup', {
    name: 'NoQuestions',
    email: 'noq@example.com',
    password: PASSWORD,
    questions: [QUESTIONS[0]],
  });
  assert.equal(status, 400);
  assert.match(body.error, /two security questions/i);
});

test('signup rejects the same question twice', async () => {
  const { status, body } = await post('/auth/signup', {
    name: 'Dupe',
    email: 'dupe@example.com',
    password: PASSWORD,
    questions: [QUESTIONS[0], { ...QUESTIONS[0], answer: 'Something' }],
  });
  assert.equal(status, 400);
  assert.match(body.error, /different/i);
});

test('signup rejects a one-character answer', async () => {
  const { status, body } = await post('/auth/signup', {
    name: 'Short',
    email: 'shortans@example.com',
    password: PASSWORD,
    questions: [QUESTIONS[0], { question: 'Street?', answer: 'x' }],
  });
  assert.equal(status, 400);
  assert.match(body.error, /too short/i);
});

test('a good signup works', async () => {
  const { status, body } = await post('/auth/signup', {
    name: 'Dad',
    email: 'recover@example.com',
    password: PASSWORD,
    questions: QUESTIONS,
  });
  assert.equal(status, 201);
  assert.ok(body.token);
});

test('the wrong password does not sign in', async () => {
  const { status } = await post('/auth/login', {
    email: 'recover@example.com',
    password: 'not the right one at all',
  });
  assert.equal(status, 401);
});

test('the right password signs in', async () => {
  const { status, body } = await post('/auth/login', {
    email: 'recover@example.com',
    password: PASSWORD,
  });
  assert.equal(status, 200);
  assert.ok(body.token);
});

test('recovery hands back the questions that were chosen', async () => {
  const { status, body } = await post('/auth/recover/questions', {
    email: 'recover@example.com',
  });
  assert.equal(status, 200);
  assert.deepEqual(body.questions, QUESTIONS.map((q) => q.question));
});

test('an unknown email still gets questions, so accounts cannot be enumerated', async () => {
  const { status, body } = await post('/auth/recover/questions', {
    email: 'nobody-has-this@example.com',
  });
  assert.equal(status, 200, 'not a 404, which would confirm the address is unused');
  assert.equal(body.questions.length, 2);
});

test('one wrong answer blocks the reset', async () => {
  const { status, body } = await post('/auth/recover/reset', {
    email: 'recover@example.com',
    answers: ['Rufus', 'Completely Wrong Street'],
    password: 'a brand new passphrase',
  });
  assert.equal(status, 401);
  assert.match(body.error, /both have to be right/i);
});

test('the old password still works after a failed reset', async () => {
  const { status } = await post('/auth/login', {
    email: 'recover@example.com',
    password: PASSWORD,
  });
  assert.equal(status, 200, 'a failed reset must not have changed anything');
});

test('a reset cannot set a weak password', async () => {
  const { status, body } = await post('/auth/recover/reset', {
    email: 'recover@example.com',
    answers: ['Rufus', 'Maple Street'],
    password: 'abc',
  });
  assert.equal(status, 400);
  assert.match(body.error, /8 characters/i);
});

test('correct answers reset the password, ignoring case and spacing', async () => {
  const { status } = await post('/auth/recover/reset', {
    email: 'recover@example.com',
    answers: ['  rUfUs ', 'maple   street'],
    password: 'a brand new passphrase',
  });
  assert.equal(status, 200);
});

test('the old password stops working and the new one starts', async () => {
  const old = await post('/auth/login', { email: 'recover@example.com', password: PASSWORD });
  assert.equal(old.status, 401);

  const fresh = await post('/auth/login', {
    email: 'recover@example.com',
    password: 'a brand new passphrase',
  });
  assert.equal(fresh.status, 200);
});

test('a reset signs every existing device out', async () => {
  const signup = await post('/auth/signup', {
    name: 'Session',
    email: 'sessions@example.com',
    password: PASSWORD,
    questions: QUESTIONS,
  });
  const token = signup.body.token;

  const before = await fetch(`${base}/children`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(before.status, 200, 'the session works to begin with');

  await post('/auth/recover/reset', {
    email: 'sessions@example.com',
    answers: ['Rufus', 'Maple Street'],
    password: 'yet another good passphrase',
  });

  const after = await fetch(`${base}/children`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(after.status, 401, 'a recovered password must not leave old devices signed in');
});

test('reset attempts are rate limited harder than logins', async () => {
  for (let i = 0; i < 12; i++) {
    const res = await post('/auth/recover/reset', {
      email: 'ratelimit@example.com',
      answers: ['guess', 'guess'],
      password: 'a long enough password',
    });
    if (res.status === 429) {
      assert.match(res.body.error, /minutes/i);
      return;
    }
  }
  assert.fail('guessing answers was never rate limited');
});

/* ------------------------------------------------------------------
   A password is required, and email confirmation.
   ------------------------------------------------------------------ */

test('an account cannot be created without a password', async () => {
  const res = await post('/auth/signup', {
    name: 'Nopass Parent',
    email: 'nopass@example.com',
    questions: QUESTIONS,
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.match(res.body.error, /password/i);
});

test('an account created with a password signs in with it', async () => {
  const made = await post('/auth/signup', {
    name: 'Verify Parent',
    email: 'verify@example.com',
    password: PASSWORD,
    questions: QUESTIONS,
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  const res = await post('/auth/login', { email: 'verify@example.com', password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.token);
});

test('a new account starts unverified and gets a confirmation link', async () => {
  const made = await post('/auth/signup', {
    name: 'Link Parent',
    email: 'link@example.com',
    password: PASSWORD,
    questions: QUESTIONS,
  });
  assert.equal(made.status, 201);
  assert.equal(made.body.parent.emailVerified, false);
  // No mail provider is configured in tests, so the link comes back rather
  // than the server claiming it sent something.
  assert.equal(made.body.verification.sent, false);
  assert.equal(made.body.verification.mailConfigured, false);
  assert.match(made.body.verification.link, /#\/verify\?parent=par_[a-z0-9]+&token=[a-f0-9]{64}/);
});

test('the confirmation link verifies the address, and is idempotent', async () => {
  const made = await post('/auth/signup', {
    name: 'Confirm Parent',
    email: 'confirm@example.com',
    password: PASSWORD,
    questions: QUESTIONS,
  });
  const url = new URL(made.body.verification.link.replace('#/verify?', 'verify?'), 'http://x/');
  const parent = url.searchParams.get('parent');
  const token = url.searchParams.get('token');

  const first = await post('/auth/verify-email', { parent, token });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.verified, true);

  // Tapping the link again must read as success, not an error.
  const second = await post('/auth/verify-email', { parent, token });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.verified, true);
});

test('a forged confirmation token is refused', async () => {
  const made = await post('/auth/signup', {
    name: 'Forge Parent',
    email: 'forge@example.com',
    password: PASSWORD,
    questions: QUESTIONS,
  });
  const url = new URL(made.body.verification.link.replace('#/verify?', 'verify?'), 'http://x/');
  const parent = url.searchParams.get('parent');

  const res = await post('/auth/verify-email', { parent, token: 'f'.repeat(64) });
  assert.equal(res.status, 400);
  assert.ok(!res.body.verified);
});

test("one account's token cannot verify another account", async () => {
  const a = await post('/auth/signup', {
    name: 'A', email: 'cross-a@example.com', password: PASSWORD, questions: QUESTIONS,
  });
  const b = await post('/auth/signup', {
    name: 'B', email: 'cross-b@example.com', password: PASSWORD, questions: QUESTIONS,
  });
  const tokenA = new URL(a.body.verification.link.replace('#/verify?', 'verify?'), 'http://x/')
    .searchParams.get('token');
  const parentB = new URL(b.body.verification.link.replace('#/verify?', 'verify?'), 'http://x/')
    .searchParams.get('parent');

  const res = await post('/auth/verify-email', { parent: parentB, token: tokenA });
  assert.equal(res.status, 400);
});

test('verifying needs both halves of the link', async () => {
  for (const body of [{}, { parent: 'par_x' }, { token: 'a'.repeat(64) }]) {
    const res = await post('/auth/verify-email', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('an empty password cannot sign in to any account', async () => {
  for (const body of [
    { email: 'verify@example.com', password: '' },
    { email: 'verify@example.com' },
    { email: 'verify@example.com', pin: '' },
  ]) {
    const res = await post('/auth/login', body);
    assert.equal(res.status, 401, `${JSON.stringify(body)} -> ${JSON.stringify(res.body)}`);
  }
});

test('signing up still refuses a single question', async () => {
  const res = await post('/auth/signup', {
    name: 'Half Parent',
    email: 'half@example.com',
    password: PASSWORD,
    questions: [QUESTIONS[0]],
  });
  assert.equal(res.status, 400);
});

test('the sign-in failure does not reveal whether an email exists', async () => {
  // Both addresses must be untouched: the rate limiter is keyed per email and
  // runs before the row lookup, so an address that has already been hammered
  // answers 429 whether or not it exists.
  await post('/auth/signup', {
    name: 'Fresh Parent',
    email: 'fresh-known@example.com',
    password: PASSWORD,
    questions: QUESTIONS,
  });

  const known = await post('/auth/login', { email: 'fresh-known@example.com', password: 'wrong-wrong-wrong' });
  const unknown = await post('/auth/login', { email: 'fresh-unknown@example.com', password: 'wrong-wrong-wrong' });

  assert.equal(known.status, 401, JSON.stringify(known.body));
  assert.equal(unknown.status, known.status);
  assert.equal(unknown.body.error, known.body.error);
});

test('the rate limiter applies to an email that does not exist', async () => {
  // Otherwise the 429 itself becomes the oracle: real accounts would start
  // refusing while unknown ones answered 401 forever.
  let sawLimit = false;
  for (let i = 0; i < 12; i++) {
    const res = await post('/auth/login', {
      email: 'never-registered@example.com',
      password: 'nope-nope-nope',
    });
    if (res.status === 429) { sawLimit = true; break; }
  }
  assert.ok(sawLimit, 'an unknown email should be rate limited too');
});
