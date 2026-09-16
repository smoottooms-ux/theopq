/**
 * Build-time configuration.
 *
 * The API URL is baked in at build time so a customer never types a server
 * address. Set it once when you build:
 *
 *   VITE_API_URL=https://api.nightshift.app npm run build
 *
 * Left unset, the app runs fully local — useful for development and for the
 * self-hosted path documented in the README.
 */

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

/** True when this build ships pointing at a hosted backend. */
export const HAS_HOSTED_BACKEND = API_URL.length > 0;

export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'help@nightshift.app';

export const APP_NAME = 'Nightshift';
