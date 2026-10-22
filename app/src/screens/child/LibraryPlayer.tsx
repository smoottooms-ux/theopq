import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Empty, TopBar, useToast } from '../../components/ui';
import { IconPause, IconPlay, IconRefresh } from '../../components/Icons';
import { ReadAlongBook } from '../../components/ReadAlongBook';
import {
  estimateScript,
  primeSpeech,
  readAloud,
  readSong,
  type ReadAlongScript,
  type ReaderHandle,
  type ReaderMode,
} from '../../lib/readalong';
import { songGrid } from '../../lib/song';
import { libraryItem, scriptFor } from '../../data/library';
import { chooseVoice } from '../../lib/playback';
import { audioUrl, releaseAudioUrl } from '../../lib/storage';

/**
 * Reading a library book, with the words lighting up as they are spoken.
 *
 * Two timing sources: a recorded or cloned take gives us an audio element we
 * can follow, and the device reader reports word boundaries directly, which is
 * exact. Both end up driving the same book component.
 */
export default function LibraryPlayer() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { data, child } = useApp();
  const toast = useToast();

  const item = itemId ? libraryItem(itemId) : undefined;
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeWord, setActiveWord] = useState<number | undefined>(undefined);
  const [url, setUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reader = useRef<ReaderHandle | null>(null);
  const raf = useRef(0);
  const [mode, setMode] = useState<ReaderMode | null>(null);
  /** Musical clock position while a song is sung by the device. */
  const [sungTime, setSungTime] = useState<number | null>(null);

  const voice = useMemo(
    () => (item ? chooseVoice(data, item) : null),
    [data, item],
  );

  const isSong = !!item && (item.kind === 'song' || !!item.tune);

  /*
   * A recorded take has its own length; the written estimate is the fallback.
   *
   * A song gets the musical grid either way. When a grown-up sings it they
   * sing in time, so a syllable on a beat tracks their take far better than
   * weighting words by how many letters they happen to contain.
   */
  const grid = useMemo(() => {
    if (!item || !isSong) return null;
    const duration = voice?.kind === 'recorded' ? voice.recording.duration : item.duration;
    return songGrid(item.pages.map((p) => p.text), duration);
  }, [item, isSong, voice]);

  const script: ReadAlongScript | null = useMemo(() => {
    if (!item) return null;
    if (grid) return grid.script;
    const duration =
      voice?.kind === 'recorded' ? voice.recording.duration : item.duration;
    return estimateScript(item.pages.map((p) => p.text), duration);
  }, [item, voice, grid]);

  useEffect(() => {
    if (voice?.kind !== 'recorded') return setUrl(null);
    const key = voice.recording.audioKey;
    let cancelled = false;
    void audioUrl(key).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
      releaseAudioUrl(key);
    };
  }, [voice]);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    audioRef.current?.pause();
    reader.current?.stop();
    reader.current = null;
    setPlaying(false);
    setActiveWord(undefined);
  }, []);

  useEffect(() => () => stop(), [stop]);

  if (!item || !script || !child || !voice) {
    return (
      <div className="screen">
        <TopBar title="Book" onBack={() => navigate('/c')} />
        <Empty emoji="🔎" title="That book is not here" />
      </div>
    );
  }

  const playRecording = () => {
    if (!url) return;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        cancelAnimationFrame(raf.current);
        setPlaying(false);
        setFinished(true);
      };
      audio.onerror = () => {
        setPlaying(false);
        toast('That recording will not play.');
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
        setFinished(false);
        follow();
      })
      .catch(() => toast('Tap play once more.'));
  };

  const speak = () => {
    setPlaying(true);
    setFinished(false);

    // A song keeps its own time, so the tempo is the tune's and not whatever
    // pace the speech engine takes a row of letters at.
    if (grid) {
      void readSong({
        grid,
        onMode: setMode,
        onTime: setSungTime,
        onDone: () => {
          setPlaying(false);
          setFinished(true);
          setSungTime(null);
        },
      }).then((handle) => {
        reader.current = handle;
      });
      return;
    }

    void readAloud({
      script,
      text: scriptFor(item),
      onMode: setMode,
      onWord: (index) => {
        setActiveWord(index);
        const target = script.words[index]?.page;
        if (typeof target === 'number') setPage(target);
      },
      onDone: () => {
        setPlaying(false);
        setFinished(true);
        setActiveWord(undefined);
      },
    }).then((handle) => {
      reader.current = handle;
    });
  };

  const toggle = () => {
    if (playing) return stop();
    // iOS only grants speech from inside the tap itself.
    primeSpeech();
    setPage(0);
    if (url) playRecording();
    else speak();
  };

  const restart = () => {
    stop();
    setFinished(false);
    setPage(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
    setTimeout(toggle, 60);
  };

  return (
    <div className="screen">
      <TopBar
        title={item.title}
        subtitle={voice.label}
        onBack={() => {
          stop();
          navigate(-1);
        }}
      />

      <ReadAlongBook
        script={script}
        seed={item.id}
        arts={item.pages.map((p) => p.art)}
        currentTime={url ? currentTime : (sungTime ?? undefined)}
        activeWord={url || sungTime !== null ? undefined : activeWord}
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

      <button className="btn btn--block btn--lg" style={{ marginTop: 18 }} onClick={toggle}>
        {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
        {playing ? 'Pause' : finished ? 'Read it again' : 'Read it to me'}
      </button>

      {item.tune && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          🎵 Sung to <strong>{item.tune}</strong>
        </p>
      )}

      {mode === 'silent' && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>
          This device has no reading voice installed, so the words light up on their own. Read it
          out loud together.
        </p>
      )}

      {voice.kind === 'device' && mode !== 'silent' && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 10 }}>
          Your grown-up has not recorded this one yet.
        </p>
      )}

      {finished && (
        <button className="btn btn--ghost btn--block btn--sm" style={{ marginTop: 12 }} onClick={restart}>
          <IconRefresh size={16} /> Again
        </button>
      )}
    </div>
  );
}
