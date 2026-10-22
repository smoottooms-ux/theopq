/**
 * Sending email.
 *
 * Deliberately provider-agnostic and deliberately optional. The product rule
 * is that a customer never signs up for a third-party service to use this app,
 * and that applies to the operator too: the server runs without a mail
 * provider, and says so, rather than failing to boot or pretending a message
 * was delivered.
 *
 * Configure with:
 *   MAIL_PROVIDER=resend
 *   MAIL_API_KEY=...
 *   MAIL_FROM="Story Station <hello@yourdomain>"
 *
 * With nothing configured, send() returns { sent: false } and the caller is
 * expected to surface the verification link some other way. Nothing in this
 * file ever claims to have sent a message it did not send.
 */

export interface MailResult {
  sent: boolean;
  /** Why not, when it was not sent. Safe to log; never shown to a user raw. */
  reason?: string;
}

const PROVIDER = process.env.MAIL_PROVIDER ?? '';
const API_KEY = process.env.MAIL_API_KEY ?? '';
const FROM = process.env.MAIL_FROM ?? 'Story Station <no-reply@storystation.app>';

export function mailConfigured(): boolean {
  return PROVIDER === 'resend' && API_KEY.length > 0;
}

export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  if (!mailConfigured()) {
    return { sent: false, reason: 'no mail provider configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, reason: `provider returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : 'send failed' };
  }
}

/** The one message this server sends. */
export function verificationBody(name: string, link: string): string {
  return [
    `Hi ${name},`,
    '',
    'Confirm your email address for Story Station by opening this link:',
    '',
    link,
    '',
    'It expires in 24 hours. If you did not create an account, ignore this —',
    'nothing happens until the link is opened.',
  ].join('\n');
}
