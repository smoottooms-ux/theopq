import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { StoryArt } from '../../components/StoryArt';
import { Empty, TopBar, useToast } from '../../components/ui';
import { IconBack, IconMic, IconPause, IconPlay, IconRefresh } from '../../components/Icons';
import { audioUrl, releaseAudioUrl } from '../../lib/storage';
import { deviceVoice } from '../../lib/voice/device';
import { voiceDescription } from '../../lib/voice';
import type { LiveHandle } from '../../lib/voice/types';
import { useCloud } from '../../lib/useCloud';

export default function Player() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const { data, child, patchStory } = useApp();
  const { markPlayed: markPlayedRemote } = useCloud();
  const toast = useToast();

  const story = data.stories.find((s) => s.id === storyId);

  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const liveRef = useRef<LiveHandle | null>(null);
  const countedPlay = useRef(false);

  /** Where each page starts, as a fraction of the whole narration. */
  const pageOffsets = useMemo(() => {
    if (!story) return [];
    const counts = story.pages.map((p) => p.text.split(/\s+/).filter(Boolean).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    let running = 0;
    return counts.map((c) => {
      const start = running / total;
      running += c;
      return start;
    });
  }, [story]);

  useEffect(() => {
    if (!story?.audioKey) return;
    let cancelled = false;
    void audioUrl(story.audioKey).then((u) => {
      if (!cancelled) setUrl(u);
    });
    const key = story.audioKey;
    return () => {
      cancelled = true;
      releaseAudioUrl(key);
    };
  }, [story?.audioKey]);

  const stopEverything = useCallback(() => {
    audioRef.current?.pause();
    liveRef.current?.stop();
    liveRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => () => stopEverything(), [stopEverything]);

  const markPlayed = useCallback(() => {
    if (!story || countedPlay.current) return;
    countedPlay.current = true;
    patchStory(story.id, {
      status: 'played',
      playedAt: Date.now(),
      playCount: story.playCount + 1,
    });
    void markPlayedRemote(story.id);
  }, [markPlayedRemote, patchStory, story]);

  /* ---------------- recorded / cloned audio ---------------- */

  const playFile = useCallback(() => {
    if (!url) return;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        if (!audio!.duration) return;
        const progress = audio!.currentTime / audio!.duration;
        // Follow the narration, but never fight a page the child turned by hand.
        const next = pageOffsets.findLastIndex((offset) => progress >= offset);
        if (next >= 0) setPage(next);
      };
      audio.onended = () => {
        setPlaying(false);
        setFinished(true);
        markPlayed();
      };
      audio.onerror = () => {
        setPlaying(false);
        toast('That recording will not play. Try the read-aloud button.');
      };
    }
    void audio.play().then(() => setPlaying(true)).catch(() => toast('Tap play once more.'));
  }, [markPlayed, pageOffsets, toast, url]);

  /* ---------------- device narrator ---------------- */

  const speakFrom = useCallback(
    async (startPage: number) => {
      if (!story) return;
      setPlaying(true);
      for (let i = startPage; i < story.pages.length; i++) {
        setPage(i);
        try {
          const handle = await deviceVoice.speakLive!({
            text: story.pages[i].text,
            voice: { } as never,
            settings: data.settings,
            style: 'bedtime',
          });
          liveRef.current = handle;
          await handle.done;
        } catch {
          setPlaying(false);
          toast('This device cannot read out loud.');
          return;
        }
        if (!liveRef.current) return; // stopped by the child
        liveRef.current = null;
      }
      setPlaying(false);
      setFinished(true);
      markPlayed();
    },
    [data.settings, markPlayed, story, toast],
  );

  const toggle = () => {
    if (playing) {
      stopEverything();
      return;
    }
    setFinished(false);
    if (url) playFile();
    else void speakFrom(page);
  };

  const restart = () => {
    stopEverything();
    setFinished(false);
    setPage(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
    countedPlay.current = false;
    setTimeout(toggle, 50);
  };

  if (!story || !child) {
    return (
      <div className="screen">
        <TopBar title="Story" onBack={() => navigate('/c')} />
        <Empty emoji="🔎" title="That story is gone" body="Ask your grown-up to send another one." />
      </div>
    );
  }

  const current = story.pages[page];
  const isLast = page === story.pages.length - 1;

  return (
    <div className="screen screen--flush">
      <div style={{ padding: '0 16px' }}>
        <TopBar
          title={story.title}
          subtitle={`from ${story.fromParentName}`}
          onBack={() => {
            stopEverything();
            navigate('/c');
          }}
        />
      </div>

      <div style={{ padding: '0 16px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <StoryArt art={current.art} seed={story.id} />
          <p
            style={{
              padding: '20px 18px',
              fontFamily: 'var(--font-display)',
              fontSize: 21,
              lineHeight: 1.65,
            }}
          >
            {current.text}
          </p>
        </div>

        <div className="row" style={{ marginTop: 14, justifyContent: 'center', gap: 6 }}>
          {story.pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-label={`Page ${i + 1}`}
              style={{
                width: i === page ? 22 : 8,
                height: 8,
                borderRadius: 999,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: i === page ? 'var(--accent)' : 'var(--line)',
                transition: 'width 0.2s ease',
              }}
            />
          ))}
        </div>

        <div className="row" style={{ marginTop: 18, gap: 12 }}>
          <button
            className="iconbtn"
            style={{ width: 56, height: 56 }}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
          >
            <IconBack />
          </button>

          <button className="btn btn--lg" style={{ flex: 1 }} onClick={toggle}>
            {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
            {playing ? 'Pause' : finished ? 'Play again' : 'Play'}
          </button>

          <button
            className="iconbtn"
            style={{ width: 56, height: 56, transform: 'scaleX(-1)' }}
            onClick={() => setPage((p) => Math.min(story.pages.length - 1, p + 1))}
            disabled={isLast}
            aria-label="Next page"
          >
            <IconBack />
          </button>
        </div>

        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          {voiceDescription(story.voiceProvider, story.fromParentName)}
        </p>

        {(finished || isLast) && (
          <div className="stack" style={{ marginTop: 22 }}>
            <button
              className="btn btn--block btn--lg"
              onClick={() => navigate(`/c/reply/${story.id}`)}
            >
              <IconMic size={20} /> Say something back to {story.fromParentName}
            </button>

            {story.comprehension.length > 0 && (
              <button
                className="btn btn--soft btn--block"
                onClick={() => navigate(`/c/games/story-recall?story=${story.id}`)}
              >
                🔍 Story Detective — questions about this story
              </button>
            )}

            <button className="btn btn--ghost btn--block btn--sm" onClick={restart}>
              <IconRefresh size={16} /> Listen again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
