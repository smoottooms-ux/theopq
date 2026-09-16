/**
 * Microphone capture with a live level meter and a local quality check.
 *
 * The quality check runs entirely on-device and is deliberately strict: a
 * clone built from clipped, noisy or half-silent audio sounds like a stranger,
 * and a parent will blame the app rather than the room they recorded in.
 */

export interface RecordingResult {
  blob: Blob;
  duration: number;
  /** 0-1 overall usability score. */
  quality: number;
  issues: string[];
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function micSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** True when the page is running inside someone else's frame. */
export function inFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent throws on access, which itself proves we are framed.
    return true;
  }
}

/**
 * Whether this page is even allowed to ask for the microphone.
 *
 * An embedded preview is the common case: a cross-origin iframe gets
 * `NotAllowedError` from getUserMedia unless the host page delegates
 * permission with `allow="microphone"`, and nothing the app does can change
 * that. Worth detecting up front so the app explains the situation instead of
 * telling a parent their microphone is broken.
 */
export function micPermissionBlockedByHost(): boolean {
  if (!inFrame()) return false;
  const policy = (document as Document & {
    featurePolicy?: { allowsFeature(feature: string): boolean };
  }).featurePolicy;
  // Where the API exists it is authoritative; elsewhere assume a framed page
  // is blocked, which matches how browsers actually behave.
  return policy ? !policy.allowsFeature('microphone') : true;
}

export interface MicProblem {
  /** Short line for a toast. */
  message: string;
  /** What the person can actually do about it. */
  fix?: string;
  /** True when no amount of tapping "allow" will help. */
  fatal: boolean;
}

/** Turns a getUserMedia rejection into something a tired parent can act on. */
export function describeMicError(err: unknown): MicProblem {
  const name = err instanceof Error ? err.name : '';

  if (micPermissionBlockedByHost()) {
    return {
      message: 'This preview cannot use the microphone.',
      fix: 'Previews run in a sandbox that blocks recording. Install the app, or open it on its own web address, and the microphone works normally.',
      fatal: true,
    };
  }

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        message: 'Microphone permission was refused.',
        fix: 'Allow microphone access for this app in your device settings, then try again.',
        fatal: false,
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        message: 'No microphone found on this device.',
        fix: 'Plug in or enable a microphone and try again.',
        fatal: true,
      };
    case 'NotReadableError':
      return {
        message: 'Something else is using the microphone.',
        fix: 'Close other apps that might be recording — a call, a voice note — and try again.',
        fatal: false,
      };
    default:
      break;
  }

  if (!window.isSecureContext) {
    return {
      message: 'Recording needs a secure connection.',
      fix: 'Open the app over https rather than http.',
      fatal: true,
    };
  }

  return {
    message: 'Could not start recording.',
    fix: err instanceof Error ? err.message : undefined,
    fatal: false,
  };
}

export class Recorder {
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private monitorGain?: GainNode;
  private raf = 0;
  private startedAt = 0;

  /**
   * Play the microphone back to the person recording.
   *
   * Only ever safe on headphones: through a speaker the microphone hears its
   * own output and the result is a howl. The UI gates this behind an explicit
   * "I have headphones in", and it starts at a low gain regardless.
   */
  monitor = false;

  /** Rolling stats used by the quality check. */
  private peak = 0;
  private sumLevel = 0;
  private frames = 0;
  private silentFrames = 0;
  private clippedFrames = 0;

  /** Called ~60x/sec with a 0-1 level so the UI can draw a meter. */
  onLevel?: (level: number) => void;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Cancellation and suppression are turned off while monitoring,
        // because they fight the guide track playing in the headphones and
        // chew holes in the recording.
        echoCancellation: !this.monitor,
        noiseSuppression: !this.monitor,
        autoGainControl: false, // AGC pumps the floor and hurts clone quality.
        channelCount: 1,
      },
    });

    this.chunks = [];
    this.peak = 0;
    this.sumLevel = 0;
    this.frames = 0;
    this.silentFrames = 0;
    this.clippedFrames = 0;

    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
    this.startedAt = Date.now();
    this.meter();
  }

  private meter(): void {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    const source = this.ctx.createMediaStreamSource(this.stream!);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);

    if (this.monitor) {
      // Deliberately below unity: loud enough to hear yourself, quiet enough
      // that a headphone that slips off does not immediately feed back.
      this.monitorGain = this.ctx.createGain();
      this.monitorGain.gain.value = 0.55;
      source.connect(this.monitorGain).connect(this.ctx.destination);
    }

    const buf = new Float32Array(this.analyser.fftSize);
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        sum += v * v;
        if (v > peak) peak = v;
      }
      const rms = Math.sqrt(sum / buf.length);

      this.frames++;
      this.sumLevel += rms;
      if (peak > this.peak) this.peak = peak;
      if (rms < 0.005) this.silentFrames++;
      if (peak > 0.985) this.clippedFrames++;

      this.onLevel?.(Math.min(1, rms * 5));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  get elapsed(): number {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
  }

  async stop(): Promise<RecordingResult> {
    const duration = this.elapsed;

    const blob = await new Promise<Blob>((resolve) => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: this.chunks[0]?.type || 'audio/webm' }));
        return;
      }
      this.recorder.onstop = () =>
        resolve(new Blob(this.chunks, { type: this.recorder!.mimeType || 'audio/webm' }));
      this.recorder.stop();
    });

    const stats = {
      avg: this.frames ? this.sumLevel / this.frames : 0,
      peak: this.peak,
      silentRatio: this.frames ? this.silentFrames / this.frames : 1,
      clippedRatio: this.frames ? this.clippedFrames / this.frames : 0,
    };

    this.teardown();
    const { quality, issues } = scoreRecording(duration, stats);
    return { blob, duration, quality, issues };
  }

  cancel(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.teardown();
  }

  /** Turns self-monitoring on or off without interrupting the take. */
  setMonitorLevel(level: number): void {
    if (this.monitorGain) this.monitorGain.gain.value = Math.max(0, Math.min(1, level));
  }

  private teardown(): void {
    cancelAnimationFrame(this.raf);
    this.monitorGain?.disconnect();
    this.monitorGain = undefined;
    this.analyser?.disconnect();
    this.analyser = undefined;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.recorder = undefined;
  }
}

interface LevelStats {
  avg: number;
  peak: number;
  silentRatio: number;
  clippedRatio: number;
}

/** Turns raw level stats into a score plus plain-English fixes. */
export function scoreRecording(duration: number, s: LevelStats): { quality: number; issues: string[] } {
  const issues: string[] = [];
  let score = 1;

  if (duration < 6) {
    issues.push('Too short — read the whole line, slowly.');
    score -= 0.45;
  } else if (duration < 10) {
    issues.push('A little short. A few more seconds helps a lot.');
    score -= 0.15;
  }

  if (s.avg < 0.015) {
    issues.push('Very quiet — hold the phone closer, about a hand away.');
    score -= 0.35;
  } else if (s.avg < 0.03) {
    issues.push('A bit quiet. Move a little closer to the mic.');
    score -= 0.12;
  }

  if (s.clippedRatio > 0.02) {
    issues.push('Too loud — it is distorting. Back off a few inches.');
    score -= 0.3;
  }

  if (s.silentRatio > 0.55) {
    issues.push('Lots of dead air. Start reading right after the countdown.');
    score -= 0.25;
  }

  // A healthy read sits well below the ceiling but well above the floor.
  if (s.peak > 0 && s.peak < 0.2) {
    issues.push('Signal is weak. Try somewhere quieter, off speakerphone.');
    score -= 0.15;
  }

  return { quality: Math.max(0, Math.min(1, score)), issues };
}

/** Plays a blob and resolves when it finishes. Used by preview buttons. */
export function playBlob(blob: Blob): { audio: HTMLAudioElement; done: Promise<void> } {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  const done = new Promise<void>((resolve) => {
    const cleanup = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onended = cleanup;
    audio.onerror = cleanup;
  });
  void audio.play().catch(() => undefined);
  return { audio, done };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
