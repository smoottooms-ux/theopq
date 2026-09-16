import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Field, LevelMeter, MicBlockedNotice, Sheet, TopBar, useToast } from '../../components/ui';
import { IconMic, IconPlay, IconSend } from '../../components/Icons';
import { StoryArt } from '../../components/StoryArt';
import { LULLABIES, type Lullaby } from '../../data/lullabies';
import { narrateLullaby } from '../../lib/cloud';
import { audioStore } from '../../lib/storage';
import { id } from '../../lib/ids';
import {
  Recorder,
  describeMicError,
  formatDuration,
  micPermissionBlockedByHost,
  micSupported,
  playBlob,
} from '../../lib/audio';
import type { LullabyDelivery } from '../../types';

/**
 * Sending a lullaby.
 *
 * Separate from stories on purpose: a lullaby is short, repeated nightly, and
 * meant to be fallen asleep to rather than followed. The child's side loops it
 * and fades it out, so this screen is only about picking one and recording it.
 */
export default function LullabiesScreen() {
  const navigate = useNavigate();
  const { data, parent, update } = useApp();
  const { cloud, connected } = useCloud();
  const toast = useToast();

  const voice = data.voices.find((v) => v.parentId === parent?.id);
  const voiceReady = voice?.status === 'ready';

  const [childId, setChildId] = useState(data.children[0]?.id ?? '');
  const [selected, setSelected] = useState<Lullaby | null>(null);
  const [ownWords, setOwnWords] = useState('');
  const [mode, setMode] = useState<'voice' | 'record'>(voiceReady ? 'voice' : 'record');
  const [busy, setBusy] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<Blob | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => {
    recorder.current?.cancel();
    clearInterval(tick.current);
  }, []);

  const child = data.children.find((c) => c.id === childId);
  const sent = data.lullabies.filter((l) => l.toChildId === childId);

  if (!parent) return null;

  const startRecording = async () => {
    if (!micSupported()) return toast('No microphone on this device.');
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

  const stopRecording = async () => {
    clearInterval(tick.current);
    const result = await recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
    setLevel(0);
    if (result) setTake(result.blob);
  };

  const send = async () => {
    if (!selected || !child) return;

    const verses = selected.id === 'custom' ? [ownWords.trim()] : selected.verses;
    if (!verses[0]) return toast('Write the words you want to say first.');

    setBusy('Preparing…');
    try {
      let audioKey: string | undefined;
      let provider: LullabyDelivery['voiceProvider'] = 'device';

      if (mode === 'record') {
        if (!take) {
          setBusy(null);
          return toast('Record yourself singing it first.');
        }
        audioKey = await audioStore.put(id('aud'), take);
        provider = 'recorded';
      } else if (voiceReady && cloud) {
        setBusy('Recording it in your voice…');
        const blob = await narrateLullaby(cloud, selected.id, verses.join('\n\n'));
        audioKey = await audioStore.put(id('aud'), blob);
        provider = 'managed';
      }

      const delivery: LullabyDelivery = {
        id: id('lul'),
        familyId: child.familyId,
        fromParentId: parent.id,
        fromParentName: parent.name,
        toChildId: child.id,
        lullabyId: selected.id,
        title: selected.title,
        verses,
        audioKey,
        voiceProvider: provider,
        createdAt: Date.now(),
        playCount: 0,
      };

      update((d) => {
        d.lullabies.unshift(delivery);
      });

      setSelected(null);
      setTake(null);
      setOwnWords('');
      toast(`"${delivery.title}" is on ${child.name}'s shelf.`);
    } catch (err) {
      if ((err as Error & { upgrade?: boolean }).upgrade) navigate('/p/plan');
      else toast(err instanceof Error ? err.message : 'Could not send that.');
    } finally {
      setBusy(null);
    }
  };

  const custom: Lullaby = {
    id: 'custom',
    title: 'Your own words',
    origin: 'Written by you.',
    duration: 40,
    mood: 'gentle',
    art: 'note',
    verses: [],
  };

  return (
    <div className="screen">
      <TopBar
        title="Lullabies"
        subtitle="Short, soft, and on repeat"
        onBack={() => navigate('/p')}
      />

      {data.children.length > 1 && (
        <div className="chips" style={{ marginBottom: 16 }}>
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
      )}

      {sent.length > 0 && (
        <>
          <div className="section-label">On {child?.name ?? 'their'} shelf</div>
          <div className="chips" style={{ marginBottom: 6 }}>
            {sent.map((l) => (
              <span key={l.id} className="badge badge--accent">
                {l.title}
                {l.playCount > 0 ? ` · ${l.playCount}×` : ''}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Pick one</div>
      <div className="stack">
        {[...LULLABIES, custom].map((lullaby) => (
          <button
            key={lullaby.id}
            className="card"
            onClick={() => {
              setSelected(lullaby);
              setTake(null);
            }}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 0 }}
          >
            <div className="row">
              <div className="avatar" aria-hidden>
                {lullaby.id === 'custom' ? '✍️' : '🎵'}
              </div>
              <div style={{ flex: 1 }}>
                <h3>{lullaby.title}</h3>
                <p className="muted">
                  {lullaby.id === 'custom'
                    ? 'Say anything you like, in your own words.'
                    : `${Math.round(lullaby.duration / 5) * 5}s · ${lullaby.origin.split(';')[0]}`}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Every lullaby here is traditional or out of copyright, so it is safe to keep forever.
      </p>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div className="stack">
            <div className="card" style={{ marginTop: 0, padding: 0, overflow: 'hidden' }}>
              <StoryArt art={selected.art} seed={selected.id} />
            </div>

            {selected.id === 'custom' ? (
              <Field label="What do you want to say?" hint="Kept exactly as you write it.">
                <textarea
                  className="textarea"
                  value={ownWords}
                  onChange={(e) => setOwnWords(e.target.value)}
                  rows={5}
                  placeholder={`Goodnight ${child?.name ?? 'sweetheart'}. I love you. See you in the morning.`}
                />
              </Field>
            ) : (
              <div className="card" style={{ marginTop: 0 }}>
                {selected.verses.map((verse, i) => (
                  <p
                    key={i}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 16,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-line',
                      marginBottom: i === selected.verses.length - 1 ? 0 : 12,
                    }}
                  >
                    {verse}
                  </p>
                ))}
                <p className="muted" style={{ marginTop: 12 }}>{selected.origin}</p>
              </div>
            )}

            <div className="chips">
              <button
                className="chip"
                aria-pressed={mode === 'voice'}
                disabled={!voiceReady || !connected}
                onClick={() => setMode('voice')}
              >
                🎙️ In my voice
              </button>
              <button className="chip" aria-pressed={mode === 'record'} onClick={() => setMode('record')}>
                🎤 Sing it myself
              </button>
            </div>

            {mode === 'record' && micPermissionBlockedByHost() && <MicBlockedNotice compact />}

            {mode === 'record' && (
              <div className="card" style={{ marginTop: 0 }}>
                {recording ? (
                  <div className="stack">
                    <LevelMeter level={level} />
                    <div className="row">
                      <span className="badge badge--accent">{formatDuration(elapsed)}</span>
                      <span className="spacer" />
                      <button className="btn btn--danger btn--sm" onClick={stopRecording}>
                        Stop
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row">
                    <button className="btn btn--soft" style={{ flex: 1 }} onClick={startRecording}>
                      <IconMic size={18} /> {take ? 'Sing it again' : 'Start singing'}
                    </button>
                    {take && (
                      <button className="iconbtn" onClick={() => playBlob(take)} aria-label="Play back">
                        <IconPlay size={18} />
                      </button>
                    )}
                  </div>
                )}
                <p className="muted" style={{ marginTop: 10 }}>
                  Out of tune is fine. It is your voice they want, not the tune.
                </p>
              </div>
            )}

            {mode === 'voice' && (
              <p className="muted">
                Your voice reads it gently rather than singing — a cloned voice cannot hold a tune,
                and we would rather say that than let you find out at bedtime.
              </p>
            )}

            <button className="btn btn--block btn--lg" onClick={send} disabled={!!busy}>
              <IconSend size={18} /> {busy ?? `Send to ${child?.name ?? 'them'}`}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

