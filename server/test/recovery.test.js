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
