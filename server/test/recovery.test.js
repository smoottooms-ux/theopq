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
   Signing in with the security answers.

   This is now the credential the app actually sends: there is no password
   field anywhere in the UI. A password is still accepted so an account made
   by an older build keeps working, but these cover the path a real user
   takes.
   ------------------------------------------------------------------ */

test('an account can be created with no password at all', async () => {
  const res = await post('/auth/signup', {
    name: 'Nopass Parent',
    email: 'nopass@example.com',
    questions: QUESTIONS,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.token, 'a session should come back');
});

test('both correct answers sign that account in', async () => {
  const res = await post('/auth/login', {
    email: 'nopass@example.com',
    answers: ['Rufus', 'Maple Street'],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.token);
});

test('answers are matched loosely enough for a tired parent', async () => {
  const res = await post('/auth/login', {
    email: 'nopass@example.com',
    answers: ['  rufus ', 'maple street'],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test('one right answer and one wrong is refused', async () => {
  const res = await post('/auth/login', {
    email: 'nopass@example.com',
    answers: ['Rufus', 'Oak Street'],
  });
  assert.equal(res.status, 401);
  assert.ok(!res.body.token);
});

test('answers in the wrong order are refused', async () => {
  const res = await post('/auth/login', {
    email: 'nopass@example.com',
    answers: ['Maple Street', 'Rufus'],
  });
  assert.equal(res.status, 401);
});

test('an empty answer array cannot walk in', async () => {
  const res = await post('/auth/login', { email: 'nopass@example.com', answers: [] });
  assert.equal(res.status, 401);
});

test('an account with no password cannot be entered with an empty password', async () => {
  // The row stores NULL password columns. Sending nothing must not match them.
  for (const body of [
    { email: 'nopass@example.com', password: '' },
    { email: 'nopass@example.com' },
    { email: 'nopass@example.com', pin: '' },
  ]) {
    const res = await post('/auth/login', body);
    assert.equal(res.status, 401, `${JSON.stringify(body)} -> ${JSON.stringify(res.body)}`);
  }
});

test('answers for one account do not open another', async () => {
  await post('/auth/signup', {
    name: 'Other Parent',
    email: 'other@example.com',
    questions: [
      { question: 'What was the name of your first pet?', answer: 'Biscuit' },
      { question: 'What street did you live on when you were eight?', answer: 'Elm Road' },
    ],
  });
  const res = await post('/auth/login', {
    email: 'other@example.com',
    answers: ['Rufus', 'Maple Street'],
  });
  assert.equal(res.status, 401);
});

test('signing up still refuses a single question', async () => {
  const res = await post('/auth/signup', {
    name: 'Half Parent',
    email: 'half@example.com',
    questions: [QUESTIONS[0]],
  });
  assert.equal(res.status, 400);
});

test('the sign-in failure does not reveal whether an email exists', async () => {
  // Both addresses must be untouched: the rate limiter is keyed per email and
  // runs before the row lookup, so an address that has already been hammered
  // answers 429 whether or not it exists. Comparing a used address against a
  // fresh one measures the limiter, not the leak.
  await post('/auth/signup', {
    name: 'Fresh Parent',
    email: 'fresh-known@example.com',
    questions: QUESTIONS,
  });

  const known = await post('/auth/login', {
    email: 'fresh-known@example.com',
    answers: ['wrong', 'wrong'],
  });
  const unknown = await post('/auth/login', {
    email: 'fresh-unknown@example.com',
    answers: ['wrong', 'wrong'],
  });

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
      answers: ['nope', 'nope'],
    });
    if (res.status === 429) {
      sawLimit = true;
      break;
    }
  }
  assert.ok(sawLimit, 'an unknown email should be rate limited too');
});
