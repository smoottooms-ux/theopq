import type { Settings, VoiceProfile, VoiceProviderId } from '../../types';

/**
 * How a provider delivers narration.
 *  - 'file' providers return an audio blob we can store and replay offline.
 *  - 'live' providers speak through the device and cannot be saved.
 */
export type SynthMode = 'file' | 'live';

export interface EnrollInput {
  /** Recorded consent-verified samples, in the order they were read. */
  samples: Blob[];
  parentName: string;
  settings: Settings;
}

export interface SynthInput {
  text: string;
  voice: VoiceProfile;
  settings: Settings;
  /** Slower and warmer for bedtime; providers map this how they can. */
  style?: 'bedtime' | 'neutral';
  signal?: AbortSignal;
}

export interface LiveHandle {
  stop(): void;
  /** Resolves when speech finishes or is stopped. */
  done: Promise<void>;
}

export interface VoiceProvider {
  id: VoiceProviderId;
  label: string;
  /** One line the parent reads before choosing. No marketing. */
  blurb: string;
  mode: SynthMode;
  /** True only if the output genuinely reproduces the enrolled speaker. */
  clonesVoice: boolean;
  /** Whether the provider is usable right now with these settings. */
  ready(settings: Settings): boolean;
  /** Why it is not usable, in plain words. */
  blockedReason(settings: Settings): string | null;
  enroll?(input: EnrollInput): Promise<{ providerVoiceId: string }>;
  synthesizeFile?(input: SynthInput): Promise<Blob>;
  speakLive?(input: SynthInput): Promise<LiveHandle>;
  deleteVoice?(voice: VoiceProfile, settings: Settings): Promise<void>;
}
