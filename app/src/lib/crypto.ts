/**
 * Password and security-answer hashing for the on-device account store.
 *
 * The server uses scrypt; browsers do not have it, so this uses PBKDF2-SHA256
 * through Web Crypto at a deliberately high iteration count. Nothing here is a
 * substitute for the server — it protects a local account on a phone someone
 * else has picked up, which is exactly the threat that matters for an app a
 * child also uses.
 *
 * Nothing is ever stored in plain text, including security answers: an answer
 * to "what was your first pet" is reused across services far more often than a
 * password is.
 */

export interface StoredSecret {
  hash: string;
  salt: string;
  iterations: number;
  algorithm: 'PBKDF2-SHA256';
}

/** OWASP's current floor for PBKDF2-HMAC-SHA256. */
const ITERATIONS = 600_000;
const KEY_BITS = 256;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const out = new Uint8Array(bytes);
  crypto.getRandomValues(out);
  return [...out].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function derive(secret: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return toHex(bits);
}

export async function hashSecret(secret: string): Promise<StoredSecret> {
  const salt = randomHex(16);
  return {
    hash: await derive(secret, salt, ITERATIONS),
    salt,
    iterations: ITERATIONS,
    algorithm: 'PBKDF2-SHA256',
  };
}

/** Constant-time comparison, so a wrong answer leaks nothing by timing. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySecret(secret: string, stored: StoredSecret): Promise<boolean> {
  // The stored iteration count is used so old records keep verifying after the
  // constant above is raised.
  const candidate = await derive(secret, stored.salt, stored.iterations);
  return equals(candidate, stored.hash);
}

/**
 * Security answers are compared loosely on purpose.
 *
 * Someone typing their first pet's name eighteen months later will not
 * reproduce their own capitalisation or spacing, and locking them out of their
 * child's bedtime stories over a stray capital letter is a worse outcome than
 * the tiny amount of entropy this gives up.
 */
export function normaliseAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?'"]/g, '');
}

export const hashAnswer = (answer: string) => hashSecret(normaliseAnswer(answer));
export const verifyAnswer = (answer: string, stored: StoredSecret) =>
  verifySecret(normaliseAnswer(answer), stored);

/* ---------------- password strength ---------------- */

export interface PasswordVerdict {
  ok: boolean;
  /** 0-4, for the meter. */
  score: number;
  message: string;
}

const COMMON = new Set([
  'password', 'password1', '12345678', '123456789', 'qwerty123', 'letmein',
  'iloveyou', 'welcome1', 'admin123', 'passw0rd', 'football', 'baseball',
  'sunshine', 'princess', 'trustno1', 'storystation',
]);

/**
 * Judges a password without being precious about it.
 *
 * Length does most of the work, so a long passphrase beats a short one with a
 * symbol bolted on, and the advice says so rather than demanding punctuation.
 */
export function checkPassword(password: string, context: string[] = []): PasswordVerdict {
  if (password.length < 8) {
    return { ok: false, score: 0, message: 'At least 8 characters. Longer is better than fancier.' };
  }
  if (COMMON.has(password.toLowerCase())) {
    return { ok: false, score: 0, message: 'That is one of the most guessed passwords there is.' };
  }
  for (const item of context) {
    if (item && item.length >= 4 && password.toLowerCase().includes(item.toLowerCase())) {
      return { ok: false, score: 1, message: 'Do not put your name or email in your password.' };
    }
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, score: 0, message: 'That is the same character over and over.' };
  }

  let score = 1;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  score = Math.min(4, score);
  const message =
    score >= 4
      ? 'Strong.'
      : score === 3
        ? 'Good.'
        : password.length < 12
          ? 'Fine. A few more words would make it much stronger.'
          : 'Fine.';

  return { ok: true, score, message };
}
