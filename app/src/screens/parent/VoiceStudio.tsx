import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, LevelMeter, MicBlockedNotice, Sheet, TopBar, useToast } from '../../components/ui';
import { IconCheck, IconMic, IconPlay, IconRefresh, IconTrash, IconX } from '../../components/Icons';
import {
  Recorder,
  describeMicError,
  formatDuration,
  micPermissionBlockedByHost,
  micSupported,
  playBlob,
  type RecordingResult,
} from '../../lib/audio';
import { ENROLL_PROMPTS, MIN_SAMPLES } from '../../lib/voice/prompts';
import { useCloud } from '../../lib/useCloud';
import {
  deleteManagedVoice,
  enrollVoice,
  previewVoice,
  uploadVoiceSample,
} from '../../lib/cloud';
import { id } from '../../lib/ids';
import type { VoiceProfile } from '../../types';

type Take = { promptId: string; blob: Blob; result: RecordingResult };

export default function VoiceStudio() {
  const navigate = useNavigate();
  const { data, parent, upsertVoice } = useApp();
  const { cloud, account, refreshAccount } = useCloud();
  const toast = useToast();

  const existing = data.voices.find((v) => v.parentId === parent?.id);

  const [takes, setTakes] = useState<Take[]>([]);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentName, setConsentName] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [stage, setStage] = useState<string | null>(null);

  const recorder = useRef<Recorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => {
    recorder.current?.cancel();
    clearInterval(tick.current);
  }, []);

  if (!parent) return null;

  const startTake = async (promptId: string) => {
    if (!micSupported()) return toast('This device will not let the app use the microphone.');

    try {
      const rec = new Recorder();
      rec.onLevel = setLevel;
      await rec.start();
      recorder.current = rec;
      setActivePrompt(promptId);
      setElapsed(0);
      tick.current = setInterval(() => setElapsed(rec.elapsed), 200);
    } catch (err) {
      const problem = describeMicError(err);
      toast(problem.fix ? `${problem.message} ${problem.fix}` : problem.message);
    }
  };

  const stopTake = async () => {
    const rec = recorder.current;
    if (!rec || !activePrompt) return;
    clearInterval(tick.current);

    const result = await rec.stop();
    recorder.current = null;
    setLevel(0);

    if (result.quality < 0.4) {
      toast(result.issues[0] ?? 'That take is not usable. Try again.');
    }

    setTakes((prev) => [
      ...prev.filter((t) => t.promptId !== activePrompt),
      { promptId: activePrompt, blob: result.blob, result },
    ]);
    setActivePrompt(null);
  };

  const cancelTake = () => {
    clearInterval(tick.current);
    recorder.current?.cancel();
    recorder.current = null;
    setActivePrompt(null);
    setLevel(0);
  };

  const usable = takes.filter((t) => t.result.quality >= 0.4);
  const averageQuality = usable.length
    ? usable.reduce((n, t) => n + t.result.quality, 0) / usable.length
    : 0;

  const submit = async () => {
    if (!consentChecked || consentName.trim().toLowerCase() !== parent.name.trim().toLowerCase()) {
      return toast(`Type "${parent.name}" exactly to confirm it is your voice.`);
    }
    if (!cloud) {
      return toast('Sign in to your Story Station account first — voice building happens there.');
    }

    setSubmitting(true);
    const profile: VoiceProfile = {
      id: existing?.id ?? id('voice'),
      parentId: parent.id,
      provider: 'managed',
      status: 'processing',
      samples: usable.map((t) => ({
        id: id('smp'),
        promptId: t.promptId,
        duration: t.result.duration,
        quality: t.result.quality,
        createdAt: Date.now(),
      })),
      consentName: parent.name,
      consentAt: Date.now(),
      updatedAt: Date.now(),
    };
    upsertVoice(profile);
    setConsentOpen(false);

    try {
      // Upload take by take, so a dropped connection costs one recording
      // rather than the whole session.
      const sampleIds: string[] = [];
      for (const [index, take] of usable.entries()) {
        setStage(`Sending recording ${index + 1} of ${usable.length}…`);
        sampleIds.push(await uploadVoiceSample(cloud, take.promptId, take.blob));
      }

      setStage('Building your voice…');
      const built = await enrollVoice(cloud, sampleIds, parent.name, consentName.trim());

      upsertVoice({
        ...profile,
        status: built.status,
        failureReason: built.failureReason,
        updatedAt: built.updatedAt,
      });
      await refreshAccount();
      setTakes([]);
      toast('Your voice is ready. Go make a story.');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Enrollment failed.';
      upsertVoice({ ...profile, status: 'failed', failureReason: reason, updatedAt: Date.now() });
      if ((err as Error & { upgrade?: boolean }).upgrade) navigate('/p/plan');
      else toast(reason);
    } finally {
      setStage(null);
      setSubmitting(false);
    }
  };

  const testVoice = async () => {
    if (!existing || existing.status !== 'ready' || !cloud) return;
    setTesting(true);
    try {
      const blob = await previewVoice(cloud, `Goodnight. It's ${parent.name}. Sleep well, I love you.`);
      await playBlob(blob).done;
    } catch (err) {
      if ((err as Error & { upgrade?: boolean }).upgrade) navigate('/p/plan');
      else toast(err instanceof Error ? err.message : 'Could not play a test.');
    } finally {
      setTesting(false);
    }
  };

  const removeVoice = async () => {
    if (!existing) return;
    if (cloud) await deleteManagedVoice(cloud).catch(() => undefined);
    upsertVoice({ ...existing, status: 'none', providerVoiceId: undefined, updatedAt: Date.now() });
    await refreshAccount();
    toast('Voice deleted.');
  };

  /* ------------------------- ready state ------------------------- */

  if (existing?.status === 'ready' && takes.length === 0) {
    return (
      <div className="screen">
        <TopBar title="Your voice" onBack={() => navigate('/p')} />

        <div className="card" style={{ textAlign: 'center' }}>
          <div className="avatar avatar--xl" style={{ margin: '0 auto 14px', color: 'var(--good)' }}>
            <IconCheck size={48} />
          </div>
          <h2>Ready</h2>
          <p className="soft" style={{ marginTop: 6 }}>
            Every story you send from now on gets read in your voice.
          </p>
          <p className="muted" style={{ marginTop: 8 }}>
            Built from {existing.samples.length} recordings ·{' '}
            {new Date(existing.updatedAt).toLocaleDateString()}
          </p>

          <button
            className="btn btn--block"
            style={{ marginTop: 16 }}
            onClick={testVoice}
            disabled={testing}
          >
            <IconPlay size={18} /> {testing ? 'Making it…' : 'Hear yourself'}
          </button>
        </div>

        <div className="card stack">
          <h3>Not quite right?</h3>
          <p className="muted">
            Voice clones improve with cleaner audio. Somewhere quiet, phone a hand's width away,
            no speakerphone.
          </p>
          <button className="btn btn--soft btn--block" onClick={() => setTakes([])}>
            <IconRefresh size={18} /> Record it again
          </button>
          <button className="btn btn--ghost btn--block btn--sm" onClick={removeVoice}>
            <IconTrash size={16} /> Delete my voice
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------- enrollment ------------------------- */

  const blocked = !cloud
    ? 'Sign in to your Story Station account to build your voice.'
    : account && !account.capabilities.voiceCloning
      ? 'Voice building is temporarily unavailable. Your recordings are safe on this device.'
      : account?.entitlement.status === 'expired'
        ? 'Your free trial has ended.'
        : null;

  return (
    <div className="screen">
      <TopBar
        title="Teach it your voice"
        subtitle={`${usable.length} of ${ENROLL_PROMPTS.length} good takes`}
        onBack={() => navigate('/p')}
      />

      {micPermissionBlockedByHost() && <MicBlockedNotice />}

      {blocked && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <h3>One step first</h3>
          <p className="soft" style={{ marginTop: 6 }}>{blocked}</p>
          <button
            className="btn btn--soft btn--block btn--sm"
            style={{ marginTop: 12 }}
            onClick={() => navigate(cloud ? '/p/plan' : '/p/account')}
          >
            {cloud ? 'See plans' : 'Sign in'}
          </button>
          <p className="muted" style={{ marginTop: 10 }}>
            Record your takes now anyway — they stay on this device until you are ready.
          </p>
        </div>
      )}

      {existing?.status === 'failed' && existing.failureReason && (
        <div className="card" style={{ borderColor: 'var(--bad)' }}>
          <h3>Last attempt failed</h3>
          <p className="soft" style={{ marginTop: 6 }}>{existing.failureReason}</p>
        </div>
      )}

      <div className="card">
        <h3>Before you start</h3>
        <ul className="soft" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Somewhere quiet. Engine off, TV off.</li>
          <li>Phone about a hand's width from your mouth.</li>
          <li>Read it how you would read it to them — slow and warm, not like the news.</li>
          <li>Wobbles are fine. Real is better than perfect.</li>
        </ul>
      </div>

      <div className="section-label">Read these out loud</div>

      <div className="stack">
        {ENROLL_PROMPTS.map((prompt, i) => {
          const take = takes.find((t) => t.promptId === prompt.id);
          const recording = activePrompt === prompt.id;

          return (
            <div
              key={prompt.id}
              className="card"
              style={recording ? { borderColor: 'var(--accent)' } : undefined}
            >
              <div className="card__head">
                <span className="badge">{i + 1}</span>
                <h3 style={{ flex: 1 }}>{prompt.label}</h3>
                {take &&
                  (take.result.quality >= 0.7 ? (
                    <span className="badge badge--good">Good</span>
                  ) : take.result.quality >= 0.4 ? (
                    <span className="badge badge--warn">Usable</span>
                  ) : (
                    <span className="badge badge--bad">Redo</span>
                  ))}
              </div>

              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                “{prompt.text}”
              </p>

              {recording ? (
                <div className="stack">
                  <LevelMeter level={level} />
                  <div className="row">
                    <span className="badge badge--accent">{formatDuration(elapsed)}</span>
                    <span className="muted" style={{ flex: 1 }}>
                      aim for about {prompt.target}s
                    </span>
                  </div>
                  <div className="row">
                    <button className="btn btn--danger" style={{ flex: 1 }} onClick={stopTake}>
                      Stop
                    </button>
                    <button className="iconbtn" onClick={cancelTake} aria-label="Cancel">
                      <IconX />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="stack">
                  {take && take.result.issues.length > 0 && (
                    <p className="muted">⚠ {take.result.issues[0]}</p>
                  )}
                  <div className="row">
                    <button
                      className={`btn ${take ? 'btn--soft' : ''}`}
                      style={{ flex: 1 }}
                      disabled={!!activePrompt}
                      onClick={() => startTake(prompt.id)}
                    >
                      <IconMic size={18} /> {take ? 'Record again' : 'Record'}
                    </button>
                    {take && (
                      <button
                        className="iconbtn"
                        onClick={() => playBlob(take.blob)}
                        aria-label="Play back"
                      >
                        <IconPlay size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ flex: 1 }}>Quality</h3>
          <span className="muted">{Math.round(averageQuality * 100)}%</span>
        </div>
        <div className="bar">
          <div className="bar__fill" style={{ width: `${Math.round(averageQuality * 100)}%` }} />
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          {usable.length < MIN_SAMPLES
            ? `Record at least ${MIN_SAMPLES} usable takes.`
            : averageQuality < 0.65
              ? 'This will work, but it will sound a bit off. Redoing the weak ones is worth it.'
              : 'That is clean audio. This will sound like you.'}
        </p>
      </div>

      <button
        className="btn btn--block btn--lg"
        style={{ marginTop: 14 }}
        disabled={usable.length < MIN_SAMPLES || !!activePrompt || !!blocked}
        onClick={() => {
          setConsentName('');
          setConsentChecked(false);
          setConsentOpen(true);
        }}
      >
        Build my voice
      </button>

      <Sheet open={consentOpen} onClose={() => setConsentOpen(false)} title="One last thing">
        <div className="stack">
          <p className="soft">
            You are about to create a synthetic copy of a human voice. That is a serious thing, so
            we make you say it out loud, in writing.
          </p>

          <label className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{ width: 22, height: 22, marginTop: 2, flex: 'none' }}
            />
            <span className="soft">
              This is <strong>my own voice</strong>. I am not cloning anyone else. I understand the
              recordings are sent to Story Station to build the model, that they are deleted once it is
              built, and that I can remove the voice at any time.
            </span>
          </label>

          <Field label={`Type your name — "${parent.name}" — to sign it`}>
            <input
              className="input"
              value={consentName}
              onChange={(e) => setConsentName(e.target.value)}
              placeholder={parent.name}
            />
          </Field>

          <button className="btn btn--block btn--lg" onClick={submit} disabled={submitting}>
            {stage ?? (submitting ? 'Building…' : 'I agree — build it')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
