import type { VoiceProvider } from './types';

/**
 * The family's cloned voice.
 *
 * Unlike the other providers this one does no work in the app: enrollment and
 * synthesis both happen on our server, against the operator's provider
 * account. That is deliberate — it is why a customer never signs up for
 * anything except Nightshift.
 *
 * The screens call `lib/cloud.ts` directly; this entry exists so the voice
 * picker, the honest labelling and the fallback ladder all have something to
 * describe.
 */
export const managedVoice: VoiceProvider = {
  id: 'managed',
  label: 'Your voice',
  blurb: 'Sounds like you. Included in your plan — nothing else to sign up for.',
  mode: 'file',
  clonesVoice: true,
  ready: () => true,
  blockedReason: () => null,
};
