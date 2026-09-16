import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import type { LiveHandle, SynthInput, VoiceProvider } from './types';

/**
 * The device's built-in narrator.
 *
 * It does NOT sound like the parent, and the UI says so everywhere it appears.
 * It exists so the app is useful the moment it is installed — a story still
 * gets read tonight while voice enrollment is pending or credits run out.
 */
export const deviceVoice: VoiceProvider = {
  id: 'device',
  label: "Device narrator",
  blurb: "Your phone's built-in reader. Free and instant — but it is not your voice.",
  mode: 'live',
  clonesVoice: false,

  ready: () => true,
  blockedReason: () => null,

  async speakLive({ text, style }: SynthInput): Promise<LiveHandle> {
    const rate = style === 'bedtime' ? 0.85 : 1;

    if (Capacitor.isNativePlatform()) {
      const done = TextToSpeech.speak({
        text,
        lang: navigator.language || 'en-US',
        rate,
        pitch: 1,
        volume: 1,
        category: 'playback',
      }).then(() => undefined);
      return {
        stop: () => void TextToSpeech.stop().catch(() => undefined),
        done: done.catch(() => undefined),
      };
    }

    // Web Speech API. Chunked, because most engines truncate long utterances.
    const synth = window.speechSynthesis;
    if (!synth) throw new Error('This device has no built-in narrator.');

    const chunks = chunkText(text, 220);
    let stopped = false;

    const done = (async () => {
      for (const chunk of chunks) {
        if (stopped) break;
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(chunk);
          u.rate = rate;
          u.pitch = 1;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          synth.speak(u);
        });
      }
    })();

    return {
      stop: () => {
        stopped = true;
        synth.cancel();
      },
      done,
    };
  },
};

/** Splits on sentence boundaries so pauses land where they should. */
function chunkText(text: string, max: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + s).length > max && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * The parent read it themselves.
 *
 * No AI in the loop at all: the recording is the story. This is the highest
 * fidelity option that exists and costs nothing.
 */
export const recordedVoice: VoiceProvider = {
  id: 'recorded',
  label: 'Recorded by you',
  blurb: 'You read the story out loud once. Nothing synthetic, nothing to set up.',
  mode: 'file',
  clonesVoice: true,

  ready: () => true,
  blockedReason: () => null,
};
