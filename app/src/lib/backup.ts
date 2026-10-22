import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { audioStore, loadData, saveData } from './storage';
import type { AppData } from '../types';

/**
 * Backup and restore.
 *
 * This exists because of a real loss. Every CI build was signed with a
 * different throwaway key, so each new APK could not install over the last
 * one — a parent had to uninstall first, and uninstalling an Android app
 * deletes its data. Seven recorded songs went with it.
 *
 * The signing key is fixed now, so updates install in place. This is the
 * belt to that braces: one file holding everything, written somewhere the
 * parent can see it, so their voice is never hostage to an install again.
 *
 * The audio is the point. Settings and stories are regenerable; a recording of
 * someone reading to their child is not.
 */

const FORMAT = 'story-station-backup';
const VERSION = 1;

export interface Backup {
  format: typeof FORMAT;
  version: number;
  createdAt: number;
  data: AppData;
  /** Audio blobs, base64, keyed exactly as the recordings reference them. */
  audio: Record<string, string>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the data: prefix; the mime type is carried separately below.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Mime type is kept inline so a restored recording still plays. */
function encode(blob: Blob, base64: string): string {
  return `${blob.type || 'audio/webm'};base64,${base64}`;
}

function decode(encoded: string): Blob {
  const marker = ';base64,';
  const at = encoded.indexOf(marker);
  if (at < 0) return base64ToBlob(encoded, 'audio/webm');
  return base64ToBlob(encoded.slice(at + marker.length), encoded.slice(0, at));
}

export async function buildBackup(): Promise<Backup> {
  const data = await loadData();
  const audio: Record<string, string> = {};

  // Only keys something actually references, so a backup does not carry
  // orphaned blobs from deleted takes.
  const wanted = new Set<string>();
  for (const r of data.recordings) wanted.add(r.audioKey);
  for (const s of data.stories) if (s.audioKey) wanted.add(s.audioKey);
  for (const r of data.replies) if (r.audioKey) wanted.add(r.audioKey);

  for (const key of wanted) {
    const blob = await audioStore.get(key);
    if (!blob) continue;
    audio[key] = encode(blob, await blobToBase64(blob));
  }

  return { format: FORMAT, version: VERSION, createdAt: Date.now(), data, audio };
}

export interface BackupWritten {
  /** Where it went, in words a person can act on. */
  location: string;
  bytes: number;
  recordings: number;
}

export async function writeBackup(): Promise<BackupWritten> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup);
  const stamp = new Date(backup.createdAt).toISOString().slice(0, 10);
  const name = `story-station-backup-${stamp}.json`;

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return {
      location: `Documents / ${name}`,
      bytes: json.length,
      recordings: Object.keys(backup.audio).length,
    };
  }

  // Browser: hand it over as a download.
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { location: name, bytes: json.length, recordings: Object.keys(backup.audio).length };
}

export interface RestoreResult {
  recordings: number;
  audioRestored: number;
  children: number;
  stories: number;
}

/**
 * Restores a backup over whatever is on the device.
 *
 * Deliberately a replace, not a merge. Merging two divergent families silently
 * produces duplicate children and recordings attributed to the wrong parent,
 * and a restore is something a person does because the device is empty or
 * wrong — replacing is what they actually mean.
 */
export async function restoreBackup(json: string): Promise<RestoreResult> {
  let parsed: Backup;
  try {
    parsed = JSON.parse(json) as Backup;
  } catch {
    throw new Error('That file is not readable. Pick the backup .json file.');
  }

  if (parsed?.format !== FORMAT) {
    throw new Error('That is not a Story Station backup.');
  }
  if (typeof parsed.version !== 'number' || parsed.version > VERSION) {
    throw new Error('That backup was made by a newer version of the app.');
  }
  if (!parsed.data || !Array.isArray(parsed.data.parents)) {
    throw new Error('That backup is incomplete.');
  }

  let audioRestored = 0;
  for (const [key, encoded] of Object.entries(parsed.audio ?? {})) {
    try {
      await audioStore.put(key, decode(encoded));
      audioRestored++;
    } catch {
      // One unreadable blob should not abandon the rest of the restore.
    }
  }

  await saveData(parsed.data);

  return {
    recordings: parsed.data.recordings?.length ?? 0,
    audioRestored,
    children: parsed.data.children?.length ?? 0,
    stories: parsed.data.stories?.length ?? 0,
  };
}
