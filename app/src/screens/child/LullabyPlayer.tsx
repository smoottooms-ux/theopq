import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Empty, TopBar, useToast } from '../../components/ui';
import { IconPause, IconPlay } from '../../components/Icons';
import { StoryArt } from '../../components/StoryArt';
import { audioUrl, releaseAudioUrl } from '../../lib/storage';
import { AMBIENTS, SLEEP_TIMERS, playAmbient, type AmbientHandle, type AmbientId } from '../../lib/ambient';
import { deviceVoice } from '../../lib/voice/device';
import { voiceDescription } from '../../lib/voice';
import { lullabyById } from '../../data/lullabies';

/**
 * The lullaby side of the child's app.
 *
 * Built to be used with the lights off by someone half asleep: big targets,
 * one decision per screen, everything loops, and everything fades rather than
 * stopping dead.
 */
export default function LullabyPlayer() {
  const navigate = useNavigate();
  const { data, child, update, setSettings } = useApp();
  const toast = useToast();

  const mine = data.lullabies.filter((l) => l.toChildId === child?.id);
  const [activeId, setActiveId] = useState<string | null>(mine[0]?.id ?? null);
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const [ambientId, setAmbientId] = useState<AmbientId | null>(
    (data.settings.ambientId as AmbientId) ?? null,
  );
  const [timerMinutes, setTimerMinutes] = useState(data.settings.sleepTimerMinutes ?? 0);
  const [remaining, setRemaining] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<AmbientHandle | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const active = mine.find((l) => l.id === activeId);

  useEffect(() => {
    if (!active?.audioKey) return setUrl(null);
    const key = active.audioKey;
    let cancelled = false;
    void audioUrl(key).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
      releaseAudioUrl(key);
    };
  }, [active?.audioKey]);

  const stopAll = useCallback((fade = 2) => {
    audioRef.current?.pause();
    audioRef.current = null;
    ambientRef.current?.stop(fade);
    ambientRef.current = null;
    clearInterval(timerRef.current);
    setRemaining(null);
    setPlaying(false);
  }, []);

  useEffect(() => () => stopAll(0), [stopAll]);

  /** Counts the sleep timer down and fades everything out at zero. */
  const armTimer = useCallback(
    (minutes: number) => {
      clearInterval(timerRef.current);
      if (minutes <= 0) return setRemaining(null);

      let left = minutes * 60;
      setRemaining(left);
      timerRef.current = setInterval(() => {
        left -= 1;
        setRemaining(left);
        if (left <= 0) {
          clearInterval(timerRef.current);
          // A long fade so a sleeping child is not woken by the silence.
          stopAll(8);
        }
      }, 1000);
    },
    [stopAll],
  );

  const start = async () => {
    if (!active) return;

    if (ambientId) {
      ambientRef.current?.stop(0.3);
      ambientRef.current = playAmbient(ambientId, 0.45);
    }

    if (url) {
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.9;
      audioRef.current = audio;
      await audio.play().catch(() => toast('Tap play once more.'));
    } else {
      // No recording yet: the device reads the words instead, and says so.
      await deviceVoice
        .speakLive?.({
          text: active.verses.join('\n\n'),
          voice: {} as never,
          settings: data.settings,
          style: 'bedtime',
        })
        .catch(() => undefined);
    }

    update((d) => {
      const i = d.lullabies.findIndex((l) => l.id === active.id);
      if (i >= 0) {
        d.lullabies[i] = {
          ...d.lullabies[i],
          playCount: d.lullabies[i].playCount + 1,
          lastPlayedAt: Date.now(),
        };
      }
    });

    setPlaying(true);
    armTimer(timerMinutes);
  };

  const toggle = () => (playing ? stopAll() : void start());

  if (!child) return null;

  return (
    <div className="screen">
      <TopBar
        title="Lullabies"
        subtitle={remaining !== null ? `Fading out in ${formatCountdown(remaining)}` : undefined}
        onBack={() => {
          stopAll(1);
          navigate('/c');
        }}
      />

      {mine.length === 0 ? (
        <Empty
          emoji="🎵"
          title="No lullabies yet"
          body="When your grown-up sends one it lives here, and you can play it every single night."
        />
      ) : (
        <>
          {active && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <StoryArt art={lullabyById(active.lullabyId)?.art ?? 'soft'} seed={active.id} />
              <div style={{ padding: 16 }}>
                <h2>{active.title}</h2>
                <p className="muted" style={{ marginTop: 4 }}>
                  {voiceDescription(active.voiceProvider, active.fromParentName)}
                  {active.playCount > 0 ? ` · played ${active.playCount}×` : ''}
                </p>
              </div>
            </div>
          )}

          <button className="btn btn--block btn--lg" style={{ marginTop: 14 }} onClick={toggle}>
            {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
            {playing ? 'Stop' : 'Play on repeat'}
          </button>

          {mine.length > 1 && (
            <>
              <div className="section-label">Choose one</div>
              <div className="chips">
                {mine.map((l) => (
                  <button
                    key={l.id}
                    className="chip"
                    aria-pressed={activeId === l.id}
                    onClick={() => {
                      stopAll(0.5);
                      setActiveId(l.id);
                    }}
                  >
                    {l.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="section-label">Sleep sounds</div>
      <div className="chips">
        <button
          className="chip"
          aria-pressed={ambientId === null}
          onClick={() => {
            setAmbientId(null);
            setSettings({ ambientId: undefined });
            ambientRef.current?.stop(1);
            ambientRef.current = null;
          }}
        >
          None
        </button>
        {AMBIENTS.map((sound) => (
          <button
            key={sound.id}
            className="chip"
            aria-pressed={ambientId === sound.id}
            onClick={() => {
              setAmbientId(sound.id);
              setSettings({ ambientId: sound.id });
              ambientRef.current?.stop(0.4);
              ambientRef.current = playAmbient(sound.id, 0.45);
              if (!playing) armTimer(timerMinutes);
            }}
          >
            <span aria-hidden>{sound.emoji}</span>
            {sound.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        {AMBIENTS.find((a) => a.id === ambientId)?.blurb ?? 'Tap one to hear it straight away.'}
      </p>

      <div className="section-label">Sleep timer</div>
      <div className="chips">
        {SLEEP_TIMERS.map((timer) => (
          <button
            key={timer.minutes}
            className="chip"
            aria-pressed={timerMinutes === timer.minutes}
            onClick={() => {
              setTimerMinutes(timer.minutes);
              setSettings({ sleepTimerMinutes: timer.minutes });
              if (playing || ambientRef.current) armTimer(timer.minutes);
            }}
          >
            {timer.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Everything fades out slowly when the timer runs out, so the quiet does not wake you.
      </p>
    </div>
  );
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}
