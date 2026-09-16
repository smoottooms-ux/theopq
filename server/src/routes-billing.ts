import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, logActivity, requireAuth } from './context.js';
import { PLANS, describeEntitlement, setPlan, type PlanId } from './entitlements.js';

/**
 * Billing.
 *
 * Stripe is optional: without keys the server still runs and plans can be
 * granted with an admin token, which is enough to pilot with real families
 * before payments are switched on. Raw HTTP rather than the Stripe SDK keeps
 * the dependency surface small and the webhook verification auditable.
 */
export const billingRoutes = express.Router();

const STRIPE_API = 'https://api.stripe.com/v1';

const stripeConfigured = (): boolean => !!process.env.STRIPE_SECRET_KEY;

/** Maps our plan ids to Stripe Price ids supplied by the operator. */
function priceFor(plan: PlanId): string | undefined {
  return {
    family: process.env.STRIPE_PRICE_FAMILY,
    family_annual: process.env.STRIPE_PRICE_FAMILY_ANNUAL,
    lifetime: process.env.STRIPE_PRICE_LIFETIME,
    trial: undefined,
    comp: undefined,
  }[plan];
}

billingRoutes.get('/billing/plans', (_req, res) => {
  res.json({
    checkoutAvailable: stripeConfigured(),
    plans: Object.values(PLANS)
      .filter((p) => p.price > 0)
      .map((p) => ({
        id: p.id,
        label: p.label,
        price: p.price,
        period: p.period,
        blurb: p.blurb,
        available: !!priceFor(p.id),
      })),
  });
});

billingRoutes.post('/billing/checkout', requireAuth('parent'), express.json(), async (req, res) => {
  if (!stripeConfigured()) {
    return res.status(503).json({ error: 'Payments are not switched on for this server yet.' });
  }

  const plan = String(req.body?.plan ?? 'family') as PlanId;
  const price = priceFor(plan);
  if (!price) return res.status(400).json({ error: 'That plan is not for sale.' });

  const parent = db
    .prepare(`SELECT email FROM parents WHERE id = ?`)
    .get(req.session!.subjectId) as { email: string } | undefined;

  const form = new URLSearchParams({
    mode: PLANS[plan].period === 'once' ? 'payment' : 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: `${process.env.APP_URL ?? ''}/#/p/plan?checkout=success`,
    cancel_url: `${process.env.APP_URL ?? ''}/#/p/plan?checkout=cancelled`,
    client_reference_id: req.session!.familyId,
    'metadata[family_id]': req.session!.familyId,
    'metadata[plan]': plan,
  });
  if (parent?.email) form.append('customer_email', parent.email);

  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!response.ok) {
    console.error('[billing] checkout failed:', await response.text().catch(() => ''));
    return res.status(502).json({ error: 'Could not start checkout. Try again shortly.' });
  }

  const session = (await response.json()) as { url?: string };
  res.json({ url: session.url });
});

/**
 * Stripe webhook.
 *
 * Mounted with a raw body parser so the signature covers the exact bytes
 * Stripe signed. Verified with a constant-time compare against the v1
 * signature in the header.
 */
billingRoutes.post(
  '/billing/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'Webhooks are not configured.' });

    if (!verifyStripeSignature(req.body as Buffer, req.header('stripe-signature'), secret)) {
      return res.status(400).json({ error: 'Bad signature.' });
    }

    let event: { type?: string; data?: { object?: Record<string, any> } };
    try {
      event = JSON.parse((req.body as Buffer).toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Bad payload.' });
    }

    const object = event.data?.object ?? {};
    const familyId: string | undefined = object.metadata?.family_id ?? object.client_reference_id;
    const plan = (object.metadata?.plan as PlanId) ?? 'family';

    switch (event.type) {
      case 'checkout.session.completed':
        if (familyId) {
          setPlan(db, familyId, plan, 'active', object.subscription ?? object.id);
          logActivity({
            familyId,
            kind: 'plan_changed',
            summary: `Subscribed to ${PLANS[plan]?.label ?? plan}`,
          });
        }
        break;

      case 'invoice.payment_failed':
        if (familyId) setPlan(db, familyId, plan, 'past_due');
        break;

      case 'customer.subscription.deleted':
        if (familyId) {
          setPlan(db, familyId, plan, 'canceled');
          logActivity({ familyId, kind: 'plan_changed', summary: 'Subscription cancelled' });
        }
        break;

      default:
        break; // Everything else is noise for our purposes.
    }

    res.json({ received: true });
  },
);

function verifyStripeSignature(body: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((part) => part.split('=').map((s) => s.trim()) as [string, string]),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject anything older than five minutes so a captured webhook cannot be replayed.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${body.toString('utf8')}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Operator escape hatch: grant or change a plan without Stripe.
 *
 * Used for pilots, refunds, support cases, and running the whole business
 * before payments are switched on. Requires ADMIN_TOKEN to be set.
 */
billingRoutes.post('/admin/plan', express.json(), (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'Admin actions are disabled.' });

  const provided = req.header('x-admin-token') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Bad admin token.' });
  }

  const { email, plan, status } = req.body ?? {};
  const parent = db
    .prepare(`SELECT family_id FROM parents WHERE email = ?`)
    .get(String(email ?? '').trim().toLowerCase()) as { family_id: string } | undefined;
  if (!parent) return res.status(404).json({ error: 'No account with that email.' });
  if (!PLANS[plan as PlanId]) return res.status(400).json({ error: 'Unknown plan.' });

  setPlan(db, parent.family_id, plan as PlanId, (status ?? 'active') as 'active');
  logActivity({
    familyId: parent.family_id,
    kind: 'plan_changed',
    summary: `Plan set to ${PLANS[plan as PlanId].label} by the operator`,
  });

  res.json(describeEntitlement(db, parent.family_id));
});
