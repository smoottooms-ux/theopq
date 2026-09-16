import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { LevelMeter, MicBlockedNotice, TopBar, useToast } from '../../components/ui';
import { IconCheck, IconMic, IconPlay } from '../../components/Icons';
import {
  Recorder,
  describeMicError,
  formatDuration,
  micPermissionBlockedByHost,
  micSupported,
  playBlob,
} from '../../lib/audio';
import { audioStore } from '../../lib/storage';
import { id } from '../../lib/ids';
import { useCloud } from '../../lib/useCloud';

/**
 * The child talking back.
 *
 * This is the feature parents on nights actually cry about, so it is
 * deliberately the simplest screen in the app: one big button, no typing,
 * no choices to get wrong.
 */
export default function ReplyRecorder() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const { data, child, addReply } = useApp();
  const { pushReply, connected } = useCloud();
  const toast = useToast();

  const story = data.stories.find((s) => s.id === storyId);

  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; duration: number } | null>(null);
  const [sent, setSent] = useState(false);

  const recorder = useRef<Recorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => {
    recorder.current?.cancel();
    clearInterval(tick.current);
  }, []);

  if (!child) return null;

  const start = async () => {
    if (!micSupported()) return toast('This tablet will not let me hear you.');
    try {
      const rec = new Recorder();
      rec.onLevel = setLevel;
      await rec.start();
      recorder.current = rec;
      setRecording(true);
      setElapsed(0);
      tick.current = setInterval(() => {
        setElapsed(rec.elapsed);
        if (rec.elapsed > 60) void stop();
      }, 200);
    } catch (err) {
      const problem = describeMicError(err);
      toast(problem.fatal ? problem.message : 'I cannot hear you. Ask a grown-up about the microphone.');
    }
  };

  const stop = async () => {
    clearInterval(tick.current);
    const result = await recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
    setLevel(0);
    if (result) setTake({ blob: result.blob, duration: result.duration });
  };

  const send = async () => {
    if (!take || !story) return;
    const audioKey = await audioStore.put(id('aud'), take.blob);
    const reply = {
      id: id('reply'),
      storyId: story.id,
      childId: child.id,
      childName: child.name,
      audioKey,
      duration: take.duration,
      createdAt: Date.now(),
    };
    addReply(reply);
    if (connected) await pushReply(reply, take.blob);
    setSent(true);
  };

  const who = story?.fromParentName ?? 'your grown-up';

  if (sent) {
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="avatar avatar--xl" style={{ margin: '0 auto 18px', color: 'var(--good)' }}>
            <IconCheck size={54} />
          </div>
          <h1>Sent!</h1>
          <p className="soft" style={{ margin: '10px auto 26px', maxWidth: 280 }}>
            {who} will hear it as soon as they pick up their phone.
          </p>
          <button className="btn btn--lg" onClick={() => navigate('/c')}>
            Goodnight 🌙
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title={`Talk to ${who}`} onBack={() => navigate(-1)} />

      {micPermissionBlockedByHost() && <MicBlockedNotice compact />}

      <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
        <p className="soft" style={{ marginBottom: 24 }}>
          Hold the button and say anything you want. {who} gets to keep it.
        </p>

        {recording ? (
          <>
            <LevelMeter level={level} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, margin: '14px 0' }}>
              {formatDuration(elapsed)}
            </div>
            <button className="btn btn--danger btn--lg btn--block" onClick={stop}>
              I'm done
            </button>
          </>
        ) : (
          <>
            <button
              onClick={start}
              aria-label="Start recording"
              style={{
                width: 148,
                height: 148,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto',
                boxShadow: 'var(--shadow)',
              }}
            >
              <IconMic size={56} />
            </button>
            <p className="muted" style={{ marginTop: 16 }}>
              {take ? 'Tap to record again' : 'Tap to start'}
            </p>
          </>
        )}
      </div>

      {take && !recording && (
        <div className="stack" style={{ marginTop: 16 }}>
          <button className="btn btn--soft btn--block" onClick={() => playBlob(take.blob)}>
            <IconPlay size={18} /> Hear it back ({formatDuration(take.duration)})
          </button>
          <button className="btn btn--block btn--lg" onClick={send}>
            Send it to {who}
          </button>
        </div>
      )}
    </div>
  );
}
