/**
 * End-to-end smoke test over the real HTTP surface.
 *
 * Runs against a throwaway data directory so it never touches a real install:
 *   npm test
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'nightshift-test-'));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = 'test';

const { app } = await import('../dist/index.js');

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

const call = async (path, options = {}) => {
  const res = await fetch(base + path, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, res };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const json = (token, payload) => ({
  method: 'POST',
  headers: { ...auth(token), 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

let parentToken;
let childToken;
let childId;
let joinCode;
const storyId = 'story_test_1';

test('health check responds', async () => {
  const { status, body } = await call('/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test('a parent can sign up', async () => {
  const { status, body } = await call('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dad',
      email: 'Dad@Example.com',
      password: 'correct horse battery staple',
      questions: [
        { question: 'First pet?', answer: 'Rufus' },
        { question: 'First street?', answer: 'Maple Street' },
      ],
    }),
  });
  assert.equal(status, 201);
  assert.ok(body.token);
  assert.equal(body.parent.email, 'dad@example.com', 'email is normalised');
  parentToken = body.token;
  joinCode = body.family.join_code;
});

test('duplicate emails are rejected', async () => {
  const { status } = await call('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dad',
      email: 'dad@example.com',
      password: 'correct horse battery staple',
      questions: [
        { question: 'First pet?', answer: 'Rufus' },
        { question: 'First street?', answer: 'Maple Street' },
      ],
    }),
  });
  assert.equal(status, 409);
});

test('a wrong PIN does not sign in', async () => {
  const { status } = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dad@example.com', password: 'wrong password entirely' }),
  });
  assert.equal(status, 401);
});

test('the right PIN signs in', async () => {
  const { status, body } = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dad@example.com', password: 'correct horse battery staple' }),
  });
  assert.equal(status, 200);
  assert.ok(body.token);
});

test('unauthenticated requests are refused', async () => {
  const { status } = await call('/children');
  assert.equal(status, 401);
});

test('a parent can add a child', async () => {
  const { status, body } = await call(
    '/children',
    json(parentToken, {
      name: 'Maya',
      age: 6,
      avatar: '🦊',
      pin: '2468',
      readingLevel: 'early',
      interests: ['space', 'dinosaurs'],
      bedtime: '19:30',
      timezone: 'Europe/London',
      gameDifficulty: 2,
    }),
  );
  assert.equal(status, 201);
  assert.equal(body.name, 'Maya');
  assert.deepEqual(body.interests, ['space', 'dinosaurs']);
  childId = body.id;
});

test('a child can sign in on their own device', async () => {
  const { status, body } = await call('/auth/child', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode, childName: 'maya', pin: '2468' }),
  });
  assert.equal(status, 200);
  assert.ok(body.token);
  childToken = body.token;
});

test('a parent can send a story', async () => {
  const { status } = await call(
    '/stories',
    json(parentToken, {
      story: {
        id: storyId,
        toChildId: childId,
        title: 'The Door in the Hill',
        pages: [{ text: 'Once upon a time.', art: 'door' }],
        scheduledFor: Date.now(),
        status: 'delivered',
        voiceProvider: 'elevenlabs',
        fromParentName: 'Dad',
      },
    }),
  );
  assert.equal(status, 201);
});

test('narration audio uploads and streams back', async () => {
  const audio = Buffer.from('fake-mp3-bytes-for-the-test');
  const upload = await call(`/stories/${storyId}/audio`, {
    method: 'POST',
    headers: { ...auth(parentToken), 'Content-Type': 'audio/mpeg' },
    body: audio,
  });
  assert.equal(upload.status, 201);

  const download = await fetch(`${base}/stories/${storyId}/audio`, { headers: auth(childToken) });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'audio/mpeg');
  assert.equal(Buffer.from(await download.arrayBuffer()).toString(), audio.toString());
});

test('the child sees the story their parent sent', async () => {
  const { status, body } = await call('/stories', { headers: auth(childToken) });
  assert.equal(status, 200);
  assert.equal(body.length, 1);
  assert.equal(body[0].title, 'The Door in the Hill');
  assert.equal(body[0].audioUrl, `/stories/${storyId}/audio`);
});

test('another family cannot read this family\'s stories', async () => {
  const other = await call('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Stranger',
      email: 'nope@example.com',
      password: 'a different long passphrase',
      questions: [
        { question: 'First pet?', answer: 'Biscuit' },
        { question: 'First street?', answer: 'Elm Road' },
      ],
    }),
  });
  const { body } = await call('/stories', { headers: auth(other.body.token) });
  assert.deepEqual(body, [], 'family scoping holds');

  const audio = await fetch(`${base}/stories/${storyId}/audio`, {
    headers: auth(other.body.token),
  });
  assert.equal(audio.status, 404);
});

test('a child cannot post stories', async () => {
  const { status } = await call('/stories', json(childToken, { story: { id: 'x', toChildId: childId } }));
  assert.equal(status, 403);
});

test('playing a story is recorded', async () => {
  const played = await call(`/stories/${storyId}/played`, { method: 'POST', headers: auth(childToken) });
  assert.equal(played.status, 204);

  const { body } = await call(`/stories?childId=${childId}`, { headers: auth(parentToken) });
  assert.equal(body[0].status, 'played');
  assert.equal(body[0].playCount, 1);
});

test('a child can reply and the parent hears it', async () => {
  const reply = await call(`/replies?storyId=${storyId}&duration=4.5`, {
    method: 'POST',
    headers: { ...auth(childToken), 'Content-Type': 'audio/webm' },
    body: Buffer.from('goodnight-daddy'),
  });
  assert.equal(reply.status, 201);

  const { body } = await call('/replies', { headers: auth(parentToken) });
  assert.equal(body.length, 1);
  assert.equal(body[0].childName, 'Maya');
  assert.equal(body[0].duration, 4.5);

  const audio = await fetch(base + body[0].audioUrl, { headers: auth(parentToken) });
  assert.equal(Buffer.from(await audio.arrayBuffer()).toString(), 'goodnight-daddy');
});

test('deleting a story removes it', async () => {
  const del = await call(`/stories/${storyId}`, { method: 'DELETE', headers: auth(parentToken) });
  assert.equal(del.status, 204);

  const { body } = await call('/stories', { headers: auth(childToken) });
  assert.deepEqual(body, []);
});
