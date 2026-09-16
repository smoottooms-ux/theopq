import type { AppData, VoiceRecording } from '../types';
import type { LibraryItem } from '../data/library';

/**
 * Deciding whose voice a library item plays in.
 *
 * The order is the whole product in one function: a parent's own recording
 * beats a synthetic copy of them, which beats the device reading it out. The
 * app never pretends the device is a parent.
 */
export type VoiceSource =
  | { kind: 'recorded'; recording: VoiceRecording; label: string }
  | { kind: 'cloned'; label: string }
  | { kind: 'device'; label: string };

export function chooseVoice(data: AppData, item: LibraryItem, parentId?: string): VoiceSource {
  const recording = data.recordings
    .filter((r) => r.itemId === item.id && (!parentId || r.parentId === parentId))
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (recording) {
    return { kind: 'recorded', recording, label: `${recording.parentName}'s voice` };
  }

  const voice = data.voices.find((v) => v.status === 'ready');
  if (voice) {
    const parent = data.parents.find((p) => p.id === voice.parentId);
    return { kind: 'cloned', label: `${parent?.name ?? 'Your grown-up'}'s voice` };
  }

  return { kind: 'device', label: 'Device narrator — not a real voice' };
}

/** How far through enrolment a parent is, in the terms the UI promises. */
export interface VoiceProgress {
  recorded: number;
  target: number;
  ready: boolean;
  /** Recordings good enough to train on. */
  usable: number;
  remaining: number;
}

/**
 * Ten is the number the app promises, and it is honest: instant cloning needs
 * roughly a minute of clean speech, and ten short songs is three to four
 * minutes. Four is the floor below which the result stops sounding like anyone.
 */
export const VOICE_TARGET = 10;
export const VOICE_MINIMUM = 4;

export function voiceProgress(data: AppData, parentId?: string): VoiceProgress {
  const mine = data.recordings.filter((r) => !parentId || r.parentId === parentId);
  const usable = mine.filter((r) => r.quality >= 0.4).length;
  const ready = data.voices.some((v) => v.parentId === parentId && v.status === 'ready');

  return {
    recorded: mine.length,
    target: VOICE_TARGET,
    ready,
    usable,
    remaining: Math.max(0, VOICE_TARGET - mine.length),
  };
}
