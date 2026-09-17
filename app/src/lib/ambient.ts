/**
 * Sleep sounds, synthesised with the Web Audio API.
 *
 * Nothing is downloaded and nothing is stored: rain, waves and the rest are
 * generated from filtered noise at runtime. That keeps the APK small, works
 * with no signal, and means a looping sound never has an audible seam the way
 * a short sample file does.
 */

export type AmbientId = 'rain' | 'waves' | 'heartbeat' | 'hush' | 'night' | 'fan';

export interface AmbientSound {
  id: AmbientId;
  label: string;
  emoji: string;
  blurb: string;
}

export const AMBIENTS: AmbientSound[] = [
  { id: 'rain', label: 'Rain', emoji: '🌧️', blurb: 'Steady rain on a window.' },
  { id: 'waves', label: 'Waves', emoji: '🌊', blurb: 'Slow water, far away.' },
  { id: 'heartbeat', label: 'Heartbeat', emoji: '💗', blurb: 'The first sound anyone ever knew.' },
  { id: 'hush', label: 'Hush', emoji: '🤍', blurb: 'Soft, even, nothing to follow.' },
  { id: 'night', label: 'Night garden', emoji: '🦗', blurb: 'Crickets and a little wind.' },
  { id: 'fan', label: 'Fan', emoji: '🌀', blurb: 'The bedroom fan you grew up with.' },
];

/** Brown noise: warmer and less hissy than white, which matters at 2am. */
function noiseBuffer(ctx: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (kind === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  // Pink, via the Voss-McCartney approximation.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

export interface AmbientHandle {
  stop(fadeSeconds?: number): void;
  setVolume(value: number): void;
  readonly id: AmbientId;
}

/**
 * Starts a sound and returns a handle. Always fades in — a sleep sound that
 * arrives at full volume defeats the purpose.
 */
export function playAmbient(id: AmbientId, volume = 0.5): AmbientHandle {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  // A WebView can hand back a context that is already suspended, and a
  // suspended context's currentTime does not advance — so the fade-in below
  // would never run and the sound would never arrive. Resuming is a no-op
  // when the context is already running.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 2.5);
  master.connect(ctx.destination);

  const stops: (() => void)[] = [];

  const loopNoise = (kind: 'white' | 'pink' | 'brown', filter: BiquadFilterNode, gain: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, kind);
    source.loop = true;
    const g = ctx.createGain();
    g.gain.value = gain;
    source.connect(filter).connect(g).connect(master);
    source.start();
    stops.push(() => source.stop());
    return source;
  };

  switch (id) {
    case 'rain': {
      const body = ctx.createBiquadFilter();
      body.type = 'bandpass';
      body.frequency.value = 1400;
      body.Q.value = 0.5;
      loopNoise('white', body, 0.5);

      const patter = ctx.createBiquadFilter();
      patter.type = 'highpass';
      patter.frequency.value = 3200;
      loopNoise('white', patter, 0.12);
      break;
    }

    case 'waves': {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      const source = loopNoise('brown', filter, 0.9);

      // A slow swell, roughly one breath every nine seconds.
      const swell = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.45;
      lfo.connect(lfoGain).connect(swell.gain);
      swell.gain.value = 0.55;
      source.disconnect();
      source.connect(filter).connect(swell).connect(master);
      lfo.start();
      stops.push(() => lfo.stop());
      break;
    }

    case 'heartbeat': {
      // Two thumps, then a rest: about 60bpm, a resting adult chest.
      let stopped = false;
      const thump = (when: number, strength: number) => {
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(64, when);
        osc.frequency.exponentialRampToValueAtTime(34, when + 0.16);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(strength, when + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
        osc.connect(g).connect(master);
        osc.start(when);
        osc.stop(when + 0.32);
      };

      const beat = () => {
        if (stopped) return;
        const now = ctx.currentTime;
        thump(now, 0.9);
        thump(now + 0.34, 0.55);
        window.setTimeout(beat, 1000);
      };
      beat();
      stops.push(() => {
        stopped = true;
      });
      break;
    }

    case 'night': {
      const air = ctx.createBiquadFilter();
      air.type = 'lowpass';
      air.frequency.value = 900;
      loopNoise('pink', air, 0.35);

      // Crickets: a short chirp pair at an irregular interval.
      let stopped = false;
      const chirp = () => {
        if (stopped) return;
        const now = ctx.currentTime;
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = 4200 + Math.random() * 600;
          const g = ctx.createGain();
          const at = now + i * 0.09;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.05, at + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
          osc.connect(g).connect(master);
          osc.start(at);
          osc.stop(at + 0.09);
        }
        window.setTimeout(chirp, 1800 + Math.random() * 2600);
      };
      chirp();
      stops.push(() => {
        stopped = true;
      });
      break;
    }

    case 'fan': {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 1.4;
      loopNoise('brown', filter, 1);

      // A faint rotational wobble, the thing that makes a fan sound like a fan.
      const wobble = ctx.createOscillator();
      wobble.frequency.value = 7.5;
      const wobbleGain = ctx.createGain();
      wobbleGain.gain.value = 40;
      wobble.connect(wobbleGain).connect(filter.frequency);
      wobble.start();
      stops.push(() => wobble.stop());
      break;
    }

    case 'hush':
    default: {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      loopNoise('pink', filter, 0.8);
      break;
    }
  }

  return {
    id,
    setVolume(value: number) {
      master.gain.setTargetAtTime(Math.max(0.0001, value), ctx.currentTime, 0.3);
    },
    stop(fadeSeconds = 2) {
      // Fade out rather than cut: a hard stop wakes a child that just went down.
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.05, fadeSeconds / 4));
      window.setTimeout(
        () => {
          stops.forEach((fn) => {
            try {
              fn();
            } catch {
              /* already stopped */
            }
          });
          void ctx.close().catch(() => undefined);
        },
        fadeSeconds * 1000 + 200,
      );
    },
  };
}

export const SLEEP_TIMERS = [
  { minutes: 0, label: 'No timer' },
  { minutes: 10, label: '10 min' },
  { minutes: 20, label: '20 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hour' },
];
