import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { LevelMeter, MicBlockedNotice, TopBar, useToast } from '../../components/ui';
import { IconCheck, IconMic, IconPause, IconPlay, IconRefresh } from '../../components/Icons';
import { ReadAlongBook } from '../../components/ReadAlongBook';
import {
  Recorder,
  describeMicError,
  formatDuration,
  micPermissionBlockedByHost,
  micSupported,
  type RecordingResult,
} from '../../lib/audio';
import {
  estimateScript,
  readAloud,
  type ReadAlongScript,
  type ReaderHandle,
  type ReaderMode,
} from '../../lib/readalong';
import { libraryItem, scriptFor } from '../../data/library';
import { audioStore } from '../../lib/storage';
import { id } from '../../lib/ids';

type Stage = 'ready' | 'listening' | 'recording' | 'review';

/**
 * Recording one item from the library.
 *
 * Three things a parent asked for and every other app gets wrong:
 *  - hear it first, so you know how it goes before the light goes red
 *  - hear it *while* recording, as a guide, which only works on headphones
 *  - see the words light up as you say them, so you never lose your place
 */
export default function RecordingStudio() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { data, parent, update } = useApp();
  const toast = useToast();

  const item = itemId ? libraryItem(itemId) : undefined;

  const [stage, setStage] = useState<Stage>('ready');
  const [page, setPage] = useState(0);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [activeWord, setActiveWord] = useState(-1);
  const [take, setTake] = useState<RecordingResult | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [headphones, setHeadphones] = useState(false);
  const [guide, setGuide] = useState(false);

  const recorder = useRef<Recorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);
  const speech = useRef<ReaderHandle | null>(null);
  const [readerMode, setReaderMode] = useState<ReaderMode | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);

  const script: ReadAlongScript | null = item
    ? estimateScript(item.pages.map((p) => p.text), item.duration)
    : null;

  const stopEverything = useCallback(() => {
    clearInterval(tick.current);
    speech.current?.stop();
    speech.current = null;
    preview.current?.pause();
    preview.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => () => {
    stopEverything();
    recorder.current?.cancel();
  }, [stopEverything]);

  if (!item || !script || !parent) return null;

  const existing = data.recordings.find(
    (r) => r.itemId === item.id && r.parentId === parent.id,
  );

  /* ---------------- hear it first ---------------- */

  /**
   * Reads the item aloud with the device voice, highlighting as it goes.
   * Used both for "hear it first" and as the guide track while recording.
   */
  const speakThrough = (onDone?: () => void) => {
    void readAloud({
      script,
      text: scriptFor(item),
      onMode: setReaderMode,
      onWord: (index) => {
        setActiveWord(index);
        const target = script.words[index]?.page;
        if (typeof target === 'number') setPage(target);
      },
      onDone: () => {
        setActiveWord(-1);
        onDone?.();
      },
    }).then((handle) => {
      speech.current = handle;
    });
  };

  const listen = () => {
    setStage('listening');
    setPage(0);
    speakThrough(() => setStage('ready'));
  };

  const stopListening = () => {
    stopEverything();
    setActiveWord(-1);
    setStage('ready');
  };

  /* ---------------- record ---------------- */

  const startRecording = async () => {
    if (!micSupported()) return toast('This device will not let the app use the microphone.');

    try {
      const rec = new Recorder();
      rec.monitor = headphones;
      rec.onLevel = setLevel;
      await rec.start();
      recorder.current = rec;

      setStage('recording');
      setPage(0);
      setElapsed(0);
      setActiveWord(-1);

      // The guide track only runs on headphones, or it ends up in the take.
      if (guide && headphones) speakThrough();

      tick.current = setInterval(() => setElapsed(rec.elapsed), 200);
    } catch (err) {
      const problem = describeMicError(err);
      toast(problem.fix ? `${problem.message} ${problem.fix}` : problem.message);
    }
  };

  const stopRecording = async () => {
    stopEverything();
    const result = await recorder.current?.stop();
    recorder.current = null;
    setLevel(0);
    setActiveWord(-1);

    if (!result) return setStage('ready');
    setTake(result);
    setStage('review');

    if (result.quality < 0.4) toast(result.issues[0] ?? 'That take is hard to use. Try again.');
  };

  /* ---------------- review and save ---------------- */

  const playBack = () => {
    if (!take) return;
    const url = URL.createObjectURL(take.blob);
    const audio = new Audio(url);
    preview.current = audio;
    setPage(0);

    audio.ontimeupdate = () => setPlayhead(audio.currentTime);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      setPlayhead(0);
      preview.current = null;
    };
    void audio.play().catch(() => toast('Could not play that back.'));
  };

  const save = async () => {
    if (!take) return;
    const audioKey = await audioStore.put(id('rec'), take.blob);

    update((d) => {
      
      const previous = d.recordings.find((r) => r.itemId === item.id && r.parentId === parent.id);
      if (previous?.audioKey) void audioStore.remove(previous.audioKey);

      const record = {
        id: previous?.id ?? id('rec'),
        itemId: item.id,
        parentId: parent.id,
        parentName: parent.name,
        audioKey,
        duration: take.duration,
        quality: take.quality,
        createdAt: Date.now(),
      };

      d.recordings = [...d.recordings.filter((r) => r.id !== record.id), record];
    });

    toast(`"${item.title}" saved in your voice.`);
    navigate(-1);
  };

  /* ---------------- render ---------------- */

  const recording = stage === 'recording';
  const listening = stage === 'listening';

  return (
    <div className="screen">
      <TopBar
        title={item.title}
        subtitle={recording ? 'Recording…' : listening ? 'Listening' : item.blurb}
        onBack={() => {
          stopEverything();
          recorder.current?.cancel();
          navigate(-1);
        }}
      />

      {micPermissionBlockedByHost() && <MicBlockedNotice />}

      <ReadAlongBook
        script={script}
        seed={item.id}
        arts={item.pages.map((p) => p.art)}
        activeWord={stage === 'review' ? undefined : activeWord}
        currentTime={stage === 'review' ? playhead : undefined}
        page={page}
        onPageChange={setPage}
        playing={recording || listening}
      />

      {item.tune && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          🎵 Sung to <strong>{item.tune}</strong>
        </p>
      )}

      {/* ---- ready ---- */}
      {stage === 'ready' && (
        <div className="stack" style={{ marginTop: 18 }}>
          {existing && (
            <div className="card" style={{ marginTop: 0, borderColor: 'var(--good)' }}>
              <div className="row">
                <div style={{ color: 'var(--good)' }}>
                  <IconCheck size={22} />
                </div>
                <p className="soft" style={{ flex: 1 }}>
                  Already recorded {new Date(existing.createdAt).toLocaleDateString()}. Recording
                  again replaces it.
                </p>
              </div>
            </div>
          )}

          <button className="btn btn--soft btn--block" onClick={listen}>
            <IconPlay size={18} /> Hear how it goes first
          </button>

          <div className="card" style={{ marginTop: 0 }}>
            <label className="row" style={{ alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={headphones}
                onChange={(e) => {
                  setHeadphones(e.target.checked);
                  if (!e.target.checked) setGuide(false);
                }}
                style={{ width: 24, height: 24, flex: 'none', marginTop: 2 }}
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15 }}>I have headphones in</h3>
                <p className="muted">
                  Unlocks hearing yourself as you record, and playing the words in your ear while
                  you read. Both need headphones — on a speaker the microphone picks them up.
                </p>
              </div>
            </label>

            {headphones && (
              <label
                className="row"
                style={{ alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginTop: 14 }}
              >
                <input
                  type="checkbox"
                  checked={guide}
                  onChange={(e) => setGuide(e.target.checked)}
                  style={{ width: 24, height: 24, flex: 'none', marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15 }}>Read it to me while I record</h3>
                  <p className="muted">
                    You will hear it a moment ahead in your headphones, like a prompt. Useful for
                    songs you half remember.
                  </p>
                </div>
              </label>
            )}
          </div>

          <button className="btn btn--block btn--lg" onClick={startRecording}>
            <IconMic size={20} /> {existing ? 'Record it again' : 'Start recording'}
          </button>

          <p className="muted" style={{ textAlign: 'center' }}>
            Read it how you would read it to them. Wobbles are fine — real is better than perfect.
          </p>
        </div>
      )}

      {/* ---- listening ---- */}
      {listening && (
        <div className="stack" style={{ marginTop: 18 }}>
          <button className="btn btn--soft btn--block btn--lg" onClick={stopListening}>
            <IconPause size={20} /> Stop
          </button>
          <p className="muted" style={{ textAlign: 'center' }}>
            {readerMode === 'silent'
              ? 'This device has no reading voice, so the words light up at reading pace instead.'
              : 'This is the device reading it. Yours will sound like you.'}
          </p>
        </div>
      )}

      {/* ---- recording ---- */}
      {recording && (
        <div className="stack" style={{ marginTop: 18 }}>
          <div className="card" style={{ marginTop: 0 }}>
            <LevelMeter level={level} />
            <div className="row" style={{ marginTop: 10 }}>
              <span className="badge badge--bad">● {formatDuration(elapsed)}</span>
              <span className="muted" style={{ flex: 1, textAlign: 'right' }}>
                about {formatDuration(item.duration)} when read slowly
              </span>
            </div>
          </div>

          <button className="btn btn--danger btn--block btn--lg" onClick={stopRecording}>
            I'm done
          </button>
        </div>
      )}

      {/* ---- review ---- */}
      {stage === 'review' && take && (
        <div className="stack" style={{ marginTop: 18 }}>
          <div className="card" style={{ marginTop: 0 }}>
            <div className="row">
              <span
                className={`badge ${
                  take.quality >= 0.7 ? 'badge--good' : take.quality >= 0.4 ? 'badge--warn' : 'badge--bad'
                }`}
              >
                {take.quality >= 0.7 ? 'Good' : take.quality >= 0.4 ? 'Usable' : 'Try again'}
              </span>
              <span className="muted" style={{ flex: 1, textAlign: 'right' }}>
                {formatDuration(take.duration)}
              </span>
            </div>
            {take.issues.length > 0 && (
              <p className="muted" style={{ marginTop: 10 }}>
                ⚠ {take.issues[0]}
              </p>
            )}
          </div>

          <button className="btn btn--soft btn--block" onClick={playBack}>
            <IconPlay size={18} /> Listen back
          </button>

          <button className="btn btn--block btn--lg" onClick={save}>
            <IconCheck size={20} /> Keep this one
          </button>

          <button
            className="btn btn--ghost btn--block btn--sm"
            onClick={() => {
              setTake(null);
              setPage(0);
              setStage('ready');
            }}
          >
            <IconRefresh size={16} /> Record it again
          </button>
        </div>
      )}
    </div>
  );
}
