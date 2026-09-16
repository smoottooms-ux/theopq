/**
 * Build-time configuration.
 *
 * The API URL is baked in at build time so a customer never types a server
 * address. Set it once when you build:
 *
 *   VITE_API_URL=https://api.storystation.app npm run build
 *
 * Left unset, the app runs fully local — useful for development and for the
 * self-hosted path documented in the README.
 */

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

/** True when this build ships pointing at a hosted backend. */
export const HAS_HOSTED_BACKEND = API_URL.length > 0;

export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'help@storystation.app';

/**
 * A Stripe Payment Link, if one is set at build time.
 *
 * Deliberately simpler than the Checkout API: paste the link Stripe gives you
 * and the app can take money, with no server keys and no webhook. The server's
 * full checkout flow still works when it is configured; this is the path for
 * getting paid this week.
 */
export const STRIPE_PAYMENT_LINK: string =
  (import.meta.env.VITE_STRIPE_LINK as string | undefined) ?? '';

export const HAS_PAYMENT_LINK = STRIPE_PAYMENT_LINK.length > 0;

export const APP_NAME = 'Story Station';

/** Headline price shown in the app. Keep in step with the Stripe link. */
export const PRICE_LABEL: string =
  (import.meta.env.VITE_PRICE_LABEL as string | undefined) ?? '£12.99/month';
