import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { ReadAlongBook } from '../../components/ReadAlongBook';
import { estimateScript, readAloud, type ReaderHandle } from '../../lib/readalong';
import { Empty, TopBar, useToast } from '../../components/ui';
import { IconBack, IconMic, IconPause, IconPlay, IconRefresh } from '../../components/Icons';
import { audioUrl, releaseAudioUrl } from '../../lib/storage';
import { voiceDescription } from '../../lib/voice';
import { storyVoice } from '../../lib/playback';
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
  const countedPlay = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [activeWord, setActiveWord] = useState<number | undefined>(undefined);
  const readerRef = useRef<ReaderHandle | null>(null);
  const raf = useRef(0);

  /** Word timings for the highlight. Paced by the recording when there is one. */
  const script = useMemo(() => {
    if (!story) return null;
    return estimateScript(
      story.pages.map((p) => p.text),
      story.durationEstimate || 120,
    );
  }, [story]);

  /**
   * The audio to play.
   *
   * A story queued by auto-pilot before its parent got round to recording it
   * still points at nothing, so a library-backed story also looks for a
   * recording of that item now. Otherwise a child hears the device narrator
   * reading a song their own parent has since sat down and sung.
   */
  const resolved = useMemo(
    () => (story ? storyVoice(data, story) : null),
    [data, story],
  );
  const audioKey = resolved?.audioKey;
  const spokenBy = resolved?.provider ?? 'device';

  useEffect(() => {
    if (!audioKey) return setUrl(null);
    let cancelled = false;
    void audioUrl(audioKey).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
      releaseAudioUrl(audioKey);
    };
  }, [audioKey]);

  const stopEverything = useCallback(() => {
    cancelAnimationFrame(raf.current);
    audioRef.current?.pause();
    readerRef.current?.stop();
    readerRef.current = null;
    setPlaying(false);
    setActiveWord(undefined);
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

      audio.onended = () => {
        cancelAnimationFrame(raf.current);
        setPlaying(false);
        setFinished(true);
        markPlayed();
      };
      audio.onerror = () => {
        setPlaying(false);
        toast('That recording will not play. Try the read-aloud button.');
      };
    }

    const follow = () => {
      setCurrentTime(audio!.currentTime);
      raf.current = requestAnimationFrame(follow);
    };

    void audio
      .play()
      .then(() => {
        setPlaying(true);
        follow();
      })
      .catch(() => toast('Tap play once more.'));
  }, [markPlayed, toast, url]);

  /* ---------------- device narrator ---------------- */

  const speakFrom = useCallback(() => {
    if (!story || !script) return;
    setPlaying(true);

    void readAloud({
      script,
      text: story.pages.map((p) => p.text).join('\n\n'),
      onWord: (index) => {
        setActiveWord(index);
        const target = script.words[index]?.page;
        if (typeof target === 'number') setPage(target);
      },
      onDone: () => {
        setPlaying(false);
        setFinished(true);
        setActiveWord(undefined);
        markPlayed();
      },
    }).then((handle) => {
      readerRef.current = handle;
    });
  }, [markPlayed, script, story]);

  const toggle = () => {
    if (playing) {
      stopEverything();
      return;
    }
    setFinished(false);
    if (url) playFile();
    else speakFrom();
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

  const isLast = page === story.pages.length - 1;
  // Dialogic reading: the grown-up's question arrives on the page it belongs to.
  const talkHere = story.talkPrompts?.find((prompt) => prompt.afterPage === page);

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
        <ReadAlongBook
          script={script!}
          seed={story.id}
          arts={story.pages.map((p) => p.art)}
          currentTime={url ? currentTime : undefined}
          activeWord={url ? undefined : activeWord}
          page={page}
          onPageChange={setPage}
          onSeekToPage={
            audioRef.current
              ? (seconds) => {
                  if (audioRef.current) audioRef.current.currentTime = seconds;
                }
              : undefined
          }
          playing={playing}
        />

        {talkHere && (
          <div
            className="card"
            style={{
              marginTop: 12,
              borderColor: 'var(--accent)',
              background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
            }}
          >
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="avatar" aria-hidden>💬</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.5 }}>
                  {talkHere.prompt}
                </p>
                <p className="muted" style={{ marginTop: 4 }}>
                  {story.fromParentName} asked this. Say your answer out loud.
                </p>
              </div>
            </div>
            <button
              className="btn btn--soft btn--block btn--sm"
              style={{ marginTop: 12 }}
              onClick={() => {
                stopEverything();
                navigate(`/c/games/story-talk?story=${story.id}`);
              }}
            >
              Answer {story.fromParentName}
            </button>
          </div>
        )}

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
          {voiceDescription(spokenBy, story.fromParentName)}
        </p>

        {(finished || isLast) && (
          <div className="stack" style={{ marginTop: 22 }}>
            <button
              className="btn btn--block btn--lg"
              onClick={() => navigate(`/c/reply/${story.id}`)}
            >
              <IconMic size={20} /> Say something back to {story.fromParentName}
            </button>

            {(story.talkPrompts?.length ?? 0) > 0 && (
              <button
                className="btn btn--soft btn--block"
                onClick={() => navigate(`/c/games/story-talk?story=${story.id}`)}
              >
                💬 Story Talk — answer {story.fromParentName}'s questions
              </button>
            )}

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
