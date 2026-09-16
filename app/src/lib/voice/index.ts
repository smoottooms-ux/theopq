import type { Settings, VoiceProfile, VoiceProviderId } from '../../types';
import { deviceVoice, recordedVoice } from './device';
import { managedVoice } from './managed';
import type { VoiceProvider } from './types';

export type { VoiceProvider, LiveHandle, SynthInput } from './types';

const PROVIDERS: Record<VoiceProviderId, VoiceProvider> = {
  managed: managedVoice,
  device: deviceVoice,
  recorded: recordedVoice,
};

export function getProvider(id: VoiceProviderId): VoiceProvider {
  return PROVIDERS[id] ?? deviceVoice;
}

export function allProviders(): VoiceProvider[] {
  return [managedVoice, recordedVoice, deviceVoice];
}

/**
 * Picks the best narration route for tonight.
 *
 * A ready clone beats everything, a parent's own recording beats a synthetic
 * stand-in, and the device narrator is the floor so a child is never left
 * with silence.
 */
export function chooseProvider(voice: VoiceProfile | undefined, _settings: Settings): VoiceProvider {
  return voice?.status === 'ready' ? managedVoice : deviceVoice;
}

/** The honest label shown next to any story's play button. */
export function voiceDescription(provider: VoiceProviderId, parentName: string): string {
  switch (provider) {
    case 'managed':
      return `${parentName}'s voice`;
    case 'recorded':
      return `Recorded by ${parentName}`;
    default:
      return 'Device narrator — not a real voice';
  }
}
