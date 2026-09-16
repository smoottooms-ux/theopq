import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import {
  ChipGroup,
  Empty,
  Field,
  LevelMeter,
  MicBlockedNotice,
  Sheet,
  TopBar,
  useToast,
} from '../../components/ui';
import { IconMic, IconPlay, IconSend, IconSpark, IconX } from '../../components/Icons';
import { StoryArt } from '../../components/StoryArt';
import { TOPIC_LIST } from '../../lib/story/packs';
import { HEARTFELT, type HeartfeltId } from '../../lib/story/heartfelt';
import { generateStory } from '../../lib/story/generate';
import { composeStory, deliver, describeSchedule, nextBedtime } from '../../lib/delivery';
import {
  Recorder,
  describeMicError,
  formatDuration,
  micPermissionBlockedByHost,
  micSupported,
  playBlob,
} from '../../lib/audio';
import { scheduleNightly } from '../../lib/notifications';
import { useCloud } from '../../lib/useCloud';
import type { StoryLength, StoryTone, StoryTopic } from '../../types';

type Narration = 'voice' | 'record' | 'device';

export default function StoryBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, parent, addStory } = useApp();
  const { cloud, connected } = useCloud();
  const toast = useToast();

  const voice = data.voices.find((v) => v.parentId === parent?.id);
  const voiceReady = voice?.status === 'ready';

  const [childId, setChildId] = useState(params.get('child') ?? data.children[0]?.id ?? '');
  const [topic, setTopic] = useState<StoryTopic>('adventure');
  const [heartfeltId, setHeartfeltId] = useState<HeartfeltId>('missed-tonight');
  const [tone, setTone] = useState<StoryTone>('gentle');
  const [length, setLength] = useState<StoryLength>('medium');
  const [note, setNote] = useState('');
  const [narration, setNarration] = useState<Narration>(voiceReady ? 'voice' : 'device');
  const [sendNow, setSendNow] = useState(false);

  const [preview, setPreview] = useState<ReturnType<typeof generateStory> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  // Read-it-yourself recorder
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [ownTake, setOwnTake] = useState<Blob | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => {
    recorder.current?.cancel();
    clearInterval(tick.current);
  }, []);

  const child = data.children.find((c) => c.id === childId);
  const heartfelt = topic === 'heartfelt';
  const template = HEARTFELT.find((h) => h.id === heartfeltId)!;

  // Resolved at send time, not render time, so a story queued after sitting on
  // this screen for twenty minutes still gets the right timestamp.
  const resolveSchedule = () => (sendNow || !child ? Date.now() : nextBedtime(child));

  if (!parent) return null;

  if (data.children.length === 0) {
    return (
      <div className="screen">
        <TopBar title="New story" onBack={() => navigate('/p')} />
        <Empty
          emoji="👶"
          title="No kids yet"
          body="Add a child profile first — the story needs someone to go to."
          action={
            <button className="btn" onClick={() => navigate('/p/family')}>
              Add a child
            </button>
          }
        />
      </div>
    );
  }

  const buildPreview = () => {
    if (!child) return;
    setPreview(
      generateStory({
        child,
        parentName: parent.name,
        topic,
        tone,
        length,
        personalNote: note.trim() || undefined,
        heartfeltId,
      }),
    );
    setPreviewOpen(true);
  };

  const startOwnRecording = async () => {
    if (!micSupported()) return toast('No microphone available on this device.');
    try {
      const rec = new Recorder();
      rec.onLevel = setLevel;
      await rec.start();
      recorder.current = rec;
      setRecording(true);
      setElapsed(0);
      tick.current = setInterval(() => setElapsed(rec.elapsed), 200);
    } catch (err) {
      const problem = describeMicError(err);
      toast(problem.fix ? `${problem.message} ${problem.fix}` : problem.message);
    }
  };

  const stopOwnRecording = async () => {
    clearInterval(tick.current);
    const result = await recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
    setLevel(0);
    if (result) setOwnTake(result.blob);
  };

  const send = async () => {
    if (!child) return;
    if (heartfelt && !note.trim()) {
      return toast('A heartfelt message needs your own words. That is the whole point.');
    }
    if (narration === 'record' && !ownTake) {
      return toast('Record yourself reading it first.');
    }

    try {
      const story = await composeStory({
        parent,
        child,
        voice: narration === 'voice' ? voice : undefined,
        settings: data.settings,
        cloud,
        brief: {
          topic,
          tone,
          length,
          personalNote: note.trim() || undefined,
          heartfeltId,
        },
        scheduledFor: resolveSchedule(),
        recorded: narration === 'record' ? (ownTake ?? undefined) : undefined,
        onProgress: setStage,
      });

      const delivered = await deliver(story, child);
      addStory(delivered);
      await scheduleNightly(child, parent.name).catch(() => undefined);

      if (delivered.failureReason) {
        toast(`Sent, but narration fell back: ${delivered.failureReason}`);
      } else {
        toast(`Sent to ${child.name} — ${describeSchedule(delivered.scheduledFor)}.`);
      }
      navigate('/p/library');
    } catch (err) {
      // Out of quota is a decision to put in front of the parent, not an error.
      if ((err as Error & { upgrade?: boolean }).upgrade) {
        toast(err instanceof Error ? err.message : 'You have used this period\'s allowance.');
        navigate('/p/plan');
      } else {
        toast(err instanceof Error ? err.message : 'Could not send that.');
      }
    } finally {
      setStage(null);
    }
  };

  return (
    <div className="screen">
      <TopBar title="New story" onBack={() => navigate('/p')} />

      <div className="section-label">Who is it for</div>
      <div className="chips">
        {data.children.map((kid) => (
          <button
            key={kid.id}
            className="chip"
            aria-pressed={childId === kid.id}
            onClick={() => setChildId(kid.id)}
          >
            <span aria-hidden>{kid.avatar}</span>
            {kid.name}
          </button>
        ))}
      </div>

      <div className="section-label">What kind of night is it</div>
      <div className="stack">
        {TOPIC_LIST.map((t) => (
          <button
            key={t.id}
            className="card"
            style={{
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              borderColor: topic === t.id ? 'var(--accent)' : 'var(--line)',
              marginTop: 0,
            }}
            onClick={() => setTopic(t.id)}
          >
            <div className="row">
              <div className="avatar" aria-hidden>{t.emoji}</div>
              <div style={{ flex: 1 }}>
                <h3>{t.label}</h3>
                <p className="muted">{t.blurb}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {heartfelt ? (
        <>
          <div className="section-label">What do you need to say</div>
          <div className="chips">
            {HEARTFELT.map((h) => (
              <button
                key={h.id}
                className="chip"
                aria-pressed={heartfeltId === h.id}
                onClick={() => setHeartfeltId(h.id)}
              >
                <span aria-hidden>{h.emoji}</span>
                {h.label}
              </button>
            ))}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <Field label="Your words" hint={template.promptForParent}>
              <textarea
                className="textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={template.promptForParent}
                rows={5}
              />
            </Field>
            <p className="muted" style={{ marginTop: 10 }}>
              This bit is not generated. It goes to {child?.name ?? 'them'} exactly as you type it.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="section-label">How it should feel</div>
          <ChipGroup
            value={tone}
            onChange={setTone}
            options={[
              { value: 'gentle', label: 'Gentle', emoji: '🌾' },
              { value: 'playful', label: 'Playful', emoji: '🎈' },
              { value: 'epic', label: 'Epic', emoji: '⚔️' },
              { value: 'silly', label: 'Silly', emoji: '🤪' },
              { value: 'sincere', label: 'Sincere', emoji: '🤍' },
            ]}
          />

          <div className="section-label">How long</div>
          <ChipGroup
            value={length}
            onChange={setLength}
            options={[
              { value: 'short', label: '~2 min' },
              { value: 'medium', label: '~4 min' },
              { value: 'long', label: '~6 min' },
            ]}
          />

          <div className="card" style={{ marginTop: 16 }}>
            <Field
              label="Say something first (optional)"
              hint="Spoken in your voice before the story starts. This is the part they replay."
            >
              <textarea
                className="textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={`I'm on nights again, ${child?.name ?? 'kiddo'}, but I'm thinking about you.`}
                rows={3}
              />
            </Field>
          </div>
        </>
      )}

      <div className="section-label">Whose voice</div>
      <div className="stack">
        <NarrationOption
          active={narration === 'voice'}
          disabled={!voiceReady}
          onClick={() => setNarration('voice')}
          emoji="🎙️"
          title={`${parent.name}'s voice`}
          body={
            voiceReady
              ? 'Your cloned voice reads it. This is the one they want.'
              : 'Not set up yet — teach the app your voice first.'
          }
        />
        <NarrationOption
          active={narration === 'record'}
          onClick={() => setNarration('record')}
          emoji="🎤"
          title="Read it yourself"
          body="Actually you, start to finish. Nothing synthetic."
        />
        <NarrationOption
          active={narration === 'device'}
          onClick={() => setNarration('device')}
          emoji="🤖"
          title="Device narrator"
          body="The phone reads it. Free, instant, and honestly not your voice."
        />
      </div>

      {narration === 'record' && micPermissionBlockedByHost() && <MicBlockedNotice compact />}

      {narration === 'record' && (
        <div className="card">
          <h3>Record the story</h3>
          <p className="muted" style={{ marginTop: 6, marginBottom: 12 }}>
            Preview the text first, then read it out loud in one go. Pauses are fine.
          </p>

          {recording ? (
            <div className="stack">
              <LevelMeter level={level} />
              <div className="row">
                <span className="badge badge--accent">{formatDuration(elapsed)}</span>
                <span className="spacer" />
                <button className="btn btn--danger btn--sm" onClick={stopOwnRecording}>
                  Stop
                </button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button className="btn btn--soft" style={{ flex: 1 }} onClick={startOwnRecording}>
                <IconMic size={18} /> {ownTake ? 'Record again' : 'Start recording'}
              </button>
              {ownTake && (
                <button
                  className="iconbtn"
                  onClick={() => playBlob(ownTake)}
                  aria-label="Play back"
                >
                  <IconPlay size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="section-label">When</div>
      <ChipGroup
        value={sendNow ? 'now' : 'bedtime'}
        onChange={(v) => setSendNow(v === 'now')}
        options={[
          { value: 'bedtime', label: child ? `Bedtime (${child.bedtime})` : 'At bedtime' },
          { value: 'now', label: 'Right now' },
        ]}
      />

      {!connected && (
        <p className="muted" style={{ marginTop: 14 }}>
          You are offline. The story will be written on this device and read by the phone — sign in
          to send it in your own voice.
        </p>
      )}

      <div className="row" style={{ marginTop: 18, gap: 10 }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={buildPreview}>
          <IconSpark size={18} /> Preview
        </button>
        <button className="btn" style={{ flex: 1.4 }} onClick={send} disabled={!!stage}>
          <IconSend size={18} /> {stage ?? 'Send it'}
        </button>
      </div>

      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title={preview?.title}>
        <div className="stack">
          {preview?.pages.map((page, i) => (
            <div key={i} className="card" style={{ marginTop: 0, padding: 0, overflow: 'hidden' }}>
              <StoryArt art={page.art} seed={`${childId}:${i}`} />
              <p style={{ padding: 16, fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.6 }}>
                {page.text}
              </p>
            </div>
          ))}
          <p className="muted" style={{ textAlign: 'center' }}>
            Preview only — the sent version is generated fresh.
          </p>
          <button className="btn btn--block" onClick={() => setPreviewOpen(false)}>
            <IconX size={18} /> Close
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function NarrationOption({
  active,
  disabled,
  onClick,
  emoji,
  title,
  body,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <button
      className="card"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        borderColor: active ? 'var(--accent)' : 'var(--line)',
        marginTop: 0,
      }}
    >
      <div className="row">
        <div className="avatar" aria-hidden>{emoji}</div>
        <div style={{ flex: 1 }}>
          <h3>{title}</h3>
          <p className="muted">{body}</p>
        </div>
      </div>
    </button>
  );
}
