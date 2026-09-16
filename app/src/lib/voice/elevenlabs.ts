import type { Settings, VoiceProfile } from '../../types';
import type { EnrollInput, SynthInput, VoiceProvider } from './types';

const API = 'https://api.elevenlabs.io/v1';

/**
 * ElevenLabs instant voice cloning.
 *
 * This is the only provider here that actually reproduces the parent's voice.
 * It needs an API key and a paid plan; the key is stored on-device and sent
 * only to elevenlabs.io.
 */
export const elevenLabs: VoiceProvider = {
  id: 'elevenlabs',
  label: 'Cloned voice',
  blurb: 'Sounds like you. Needs an ElevenLabs API key and about a minute of clean audio.',
  mode: 'file',
  clonesVoice: true,

  ready: (s: Settings) => !!s.elevenLabsKey?.trim(),

  blockedReason: (s: Settings) =>
    s.elevenLabsKey?.trim() ? null : 'Add an ElevenLabs API key in Settings to use voice cloning.',

  async enroll({ samples, parentName, settings }: EnrollInput) {
    const key = requireKey(settings);
    const form = new FormData();
    form.append('name', `Nightshift · ${parentName}`);
    form.append(
      'description',
      'Bedtime narration voice, enrolled with recorded consent inside the Nightshift app.',
    );
    samples.forEach((blob, i) => {
      form.append('files', blob, `sample-${i + 1}.${extensionFor(blob.type)}`);
    });
    form.append('labels', JSON.stringify({ app: 'nightshift', use: 'bedtime-stories' }));

    const res = await fetch(`${API}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
    });
    if (!res.ok) throw new Error(await describeError(res, 'Voice enrollment failed'));

    const data = (await res.json()) as { voice_id?: string };
    if (!data.voice_id) throw new Error('ElevenLabs did not return a voice id.');
    return { providerVoiceId: data.voice_id };
  },

  async synthesizeFile({ text, voice, settings, style, signal }: SynthInput) {
    const key = requireKey(settings);
    if (!voice.providerVoiceId) throw new Error('This voice has not finished enrolling yet.');

    const res = await fetch(`${API}/text-to-speech/${voice.providerVoiceId}`, {
      method: 'POST',
      signal,
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings:
          style === 'bedtime'
            ? { stability: 0.62, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true }
            : { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
      }),
    });
    if (!res.ok) throw new Error(await describeError(res, 'Narration failed'));
    return res.blob();
  },

  async deleteVoice(voice: VoiceProfile, settings: Settings) {
    if (!voice.providerVoiceId) return;
    const key = settings.elevenLabsKey?.trim();
    if (!key) return;
    await fetch(`${API}/voices/${voice.providerVoiceId}`, {
      method: 'DELETE',
      headers: { 'xi-api-key': key },
    }).catch(() => undefined);
  },
};

function requireKey(settings: Settings): string {
  const key = settings.elevenLabsKey?.trim();
  if (!key) throw new Error('No ElevenLabs API key set. Add one in Settings.');
  return key;
}

function extensionFor(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

/** Turns an API failure into something a tired parent can act on. */
async function describeError(res: Response, prefix: string): Promise<string> {
  let detail = '';
  try {
    const body = (await res.json()) as { detail?: { message?: string; status?: string } | string };
    detail =
      typeof body.detail === 'string' ? body.detail : body.detail?.message ?? body.detail?.status ?? '';
  } catch {
    detail = await res.text().catch(() => '');
  }

  if (res.status === 401) return `${prefix}: that API key was rejected. Check it in Settings.`;
  if (res.status === 402 || /quota|credit/i.test(detail))
    return `${prefix}: the ElevenLabs account is out of credits.`;
  if (res.status === 403 && /voice_add|subscription/i.test(detail))
    return `${prefix}: this plan does not include voice cloning. Upgrade the ElevenLabs plan.`;
  if (res.status === 429) return `${prefix}: too many requests at once. Wait a moment and retry.`;
  return `${prefix}: ${detail || `${res.status} ${res.statusText}`}`;
}
