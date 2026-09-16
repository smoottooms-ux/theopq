import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useApp } from '../../lib/store';
import { Empty, TopBar } from '../../components/ui';
import { IconCheck, IconPlay, IconX } from '../../components/Icons';
import { gameById, type Question } from '../../games';
import { review } from '../../lib/srs';
import type { SkillCard } from '../../types';
import { deviceVoice } from '../../lib/voice/device';
import { id } from '../../lib/ids';
import { useCloud } from '../../lib/useCloud';
import { Recorder, formatDuration, micSupported } from '../../lib/audio';
import { audioStore } from '../../lib/storage';
import { LevelMeter } from '../../components/ui';
import { IconMic } from '../../components/Icons';

/** Quality for the scheduler: fast and right earns a longer gap than slow and right. */
function quality(correct: boolean, ms: number): number {
  if (!correct) return 1;
  return ms < 4000 ? 5 : ms < 9000 ? 4 : 3;
}

export default function GameRunner() {
  const { gameId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data, child, recordSession } = useApp();

  const game = gameId ? gameById(gameId) : undefined;
  const story = data.stories.find((s) => s.id === params.get('story'));

  const round = useMemo(() => {
    if (!game || !child) return null;
    return game.build({ child, data, story });
    // A round is fixed once it starts; rebuilding mid-game would shuffle
    // the questions under the child's fingers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, child?.id, story?.id]);

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [built, setBuilt] = useState<string[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const cards = useRef<SkillCard[]>([]);
  const askedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (round) cards.current = [...round.cards];
  }, [round]);

  const question: Question | undefined = round?.questions[index];

  const speak = useCallback((text?: string) => {
    if (!text) return;
    void deviceVoice
      .speakLive?.({ text, voice: {} as never, settings: data.settings, style: 'neutral' })
      .catch(() => undefined);
  }, [data.settings]);

  useEffect(() => {
    askedAt.current = Date.now();
    setPicked(null);
    setBuilt([]);
    if (question?.speak) speak(question.speak);
  }, [index, question?.speak, speak]);

  const finish = useCallback(
    (finalCorrect: number, total: number) => {
      if (!child || !game) return;
      recordSession(
        {
          id: id('sess'),
          childId: child.id,
          game: game.title,
          skill: game.skill,
          correct: finalCorrect,
          total,
          ms: Date.now() - startedAt.current,
          createdAt: Date.now(),
        },
        cards.current,
      );
      setDone(true);
    },
    [child, game, recordSession],
  );

  const grade = (answer: string) => {
    if (!question || picked !== null) return;

    const isCorrect = answer === question.answer;
    setPicked(answer);

    const i = cards.current.findIndex((c) => c.key === question.key);
    if (i >= 0) {
      cards.current[i] = review(cards.current[i], quality(isCorrect, Date.now() - askedAt.current));
    }

    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    if (isCorrect) setCorrectCount(nextCorrect);
    void Haptics.impact({ style: isCorrect ? ImpactStyle.Light : ImpactStyle.Heavy }).catch(
      () => undefined,
    );

    // Wrong answers linger so the explanation gets read.
    window.setTimeout(
      () => {
        if (!round) return;
        if (index + 1 >= round.questions.length) finish(nextCorrect, round.questions.length);
        else setIndex((n) => n + 1);
      },
      isCorrect ? 850 : 2400,
    );
  };

  if (!game || !child) return null;

  if (!round || round.questions.length === 0) {
    return (
      <div className="screen">
        <TopBar title={game.title} onBack={() => navigate('/c/games')} />
        <Empty
          emoji="🌙"
          title="Nothing to play here yet"
          body="Listen to a story first — the questions come from the story you heard."
        />
      </div>
    );
  }

  if (done) {
    const total = round.questions.length;
    const pct = Math.round((correctCount / total) * 100);
    const openEnded = round.questions.every((question) => question.openEnded);

    if (openEnded) {
      return (
        <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 68 }} aria-hidden>💬</div>
            <h1 style={{ marginTop: 10 }}>All sent</h1>
            <p className="soft" style={{ margin: '10px auto 26px', maxWidth: 300 }}>
              {story?.fromParentName ?? 'Your grown-up'} will hear every answer. Talking about a
              story out loud is one of the best things you can do for your reading.
            </p>
            <button className="btn btn--lg" onClick={() => navigate('/c/games')}>
              Back to games
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 68 }} aria-hidden>
            {pct >= 80 ? '🌟' : pct >= 50 ? '💪' : '🌱'}
          </div>
          <h1 style={{ marginTop: 10 }}>
            {correctCount} out of {total}
          </h1>
          <p className="soft" style={{ margin: '10px auto 26px', maxWidth: 300 }}>
            {pct >= 80
              ? 'That was sharp. The hard ones will come back in a few days to make sure it stuck.'
              : pct >= 50
                ? 'Good work. The ones you missed will come back soon so you get them next time.'
                : 'These were tough. That is exactly when your brain grows most. Same ones tomorrow.'}
          </p>
          <div className="stack">
            <button
              className="btn btn--lg"
              onClick={() => {
                setIndex(0);
                setCorrectCount(0);
                setDone(false);
                startedAt.current = Date.now();
              }}
            >
              Play again
            </button>
            <button className="btn btn--ghost" onClick={() => navigate('/c/games')}>
              Back to games
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = question!;
  const answered = picked !== null;
  const gotIt = picked === q.answer;

  return (
    <div className="screen">
      <TopBar
        title={game.title}
        subtitle={`${index + 1} of ${round.questions.length}`}
        onBack={() => navigate('/c/games')}
        right={
          q.speak ? (
            <button className="iconbtn" onClick={() => speak(q.speak)} aria-label="Say it again">
              <IconPlay size={20} />
            </button>
          ) : undefined
        }
      />

      <div className="bar" style={{ marginBottom: 20 }}>
        <div
          className="bar__fill"
          style={{ width: `${((index + (answered ? 1 : 0)) / round.questions.length) * 100}%` }}
        />
      </div>

      {q.rule && (
        <div
          className="card"
          style={{
            marginBottom: 12,
            textAlign: 'center',
            background: 'color-mix(in srgb, var(--accent) 16%, var(--surface))',
            borderColor: 'var(--accent)',
          }}
        >
          <p style={{ fontWeight: 600 }}>{q.rule}</p>
        </div>
      )}

      <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
        {q.visual && (
          <div style={{ fontSize: q.visual.length > 4 ? 30 : 60, marginBottom: 12 }} aria-hidden>
            {q.visual}
          </div>
        )}
        <h2 style={{ fontSize: 22 }}>{q.prompt}</h2>
      </div>

      {q.kind === 'choice' && (
        <div className="stack" style={{ marginTop: 18 }}>
          {q.choices?.map((choice) => (
            <AnswerButton
              key={choice}
              label={choice}
              state={
                !answered
                  ? 'idle'
                  : choice === q.answer
                    ? 'right'
                    : choice === picked
                      ? 'wrong'
                      : 'dim'
              }
              onClick={() => grade(choice)}
            />
          ))}
        </div>
      )}

      {q.kind === 'build' && (
        <BuildAnswer
          question={q}
          built={built}
          answered={answered}
          onChange={setBuilt}
          onSubmit={() => grade(built.join(''))}
        />
      )}

      {q.kind === 'numberline' && (
        <NumberLineAnswer question={q} answered={answered} picked={picked} onPick={grade} />
      )}

      {q.kind === 'sort' && (
        <SortAnswer question={q} answered={answered} picked={picked} onPick={grade} />
      )}

      {q.kind === 'gonogo' && (
        <GoNoGo
          question={q}
          answered={answered}
          onDone={(hitRate) => grade(hitRate >= 0.75 ? 'complete' : 'missed')}
        />
      )}

      {q.kind === 'speak' && (
        <SpeakAnswer
          question={q}
          answered={answered}
          storyId={story?.id}
          onDone={grade}
        />
      )}

      {answered && q.openEnded && (
        <div className="card" style={{ marginTop: 18, borderColor: 'var(--good)', textAlign: 'center' }}>
          <div style={{ color: 'var(--good)' }}>
            <IconCheck size={28} />
          </div>
          <p className="soft" style={{ marginTop: 6 }}>
            Sent to {story?.fromParentName ?? 'your grown-up'}. There is no wrong answer to this one.
          </p>
        </div>
      )}

      {answered && !q.openEnded && (
        <div
          className="card"
          style={{
            marginTop: 18,
            borderColor: gotIt ? 'var(--good)' : 'var(--warn)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: gotIt ? 'var(--good)' : 'var(--warn)' }}>
            {gotIt ? <IconCheck size={28} /> : <IconX size={28} />}
          </div>
          <p className="soft" style={{ marginTop: 6 }}>
            {gotIt ? 'Yes!' : q.explain ?? `It was "${q.answer}".`}
          </p>
        </div>
      )}
    </div>
  );
}

function AnswerButton({
  label,
  state,
  onClick,
}: {
  label: string;
  state: 'idle' | 'right' | 'wrong' | 'dim';
  onClick: () => void;
}) {
  const style: React.CSSProperties = { marginTop: 0, width: '100%', cursor: 'pointer' };
  if (state === 'right') {
    style.borderColor = 'var(--good)';
    style.background = 'color-mix(in srgb, var(--good) 16%, var(--surface))';
  } else if (state === 'wrong') {
    style.borderColor = 'var(--bad)';
    style.background = 'color-mix(in srgb, var(--bad) 16%, var(--surface))';
  } else if (state === 'dim') {
    style.opacity = 0.45;
  }

  return (
    <button className="card" style={style} onClick={onClick} disabled={state !== 'idle'}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{label}</span>
    </button>
  );
}

function BuildAnswer({
  question,
  built,
  answered,
  onChange,
  onSubmit,
}: {
  question: Question;
  built: string[];
  answered: boolean;
  onChange: (next: string[]) => void;
  onSubmit: () => void;
}) {
  const used = new Map<string, number>();
  built.forEach((t) => used.set(t, (used.get(t) ?? 0) + 1));

  return (
    <div className="stack" style={{ marginTop: 18 }}>
      <div
        className="card"
        style={{
          minHeight: 78,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 0,
        }}
      >
        {built.length === 0 ? (
          <span className="muted">Tap the sounds in order</span>
        ) : (
          built.map((tile, i) => (
            <button
              key={`${tile}-${i}`}
              className="chip"
              style={{ fontSize: 22, minHeight: 48 }}
              disabled={answered}
              onClick={() => onChange(built.filter((_, n) => n !== i))}
            >
              {tile}
            </button>
          ))
        )}
      </div>

      <div className="chips" style={{ justifyContent: 'center' }}>
        {question.tiles?.map((tile, i) => {
          const available =
            question.tiles!.filter((t) => t === tile).length > (used.get(tile) ?? 0);
          return (
            <button
              key={`${tile}-${i}`}
              className="chip"
              style={{ fontSize: 24, minHeight: 58, minWidth: 58, justifyContent: 'center' }}
              disabled={answered || !available}
              onClick={() => onChange([...built, tile])}
            >
              {tile}
            </button>
          );
        })}
      </div>

      <button
        className="btn btn--block btn--lg"
        disabled={answered || built.length === 0}
        onClick={onSubmit}
      >
        That's my word
      </button>
    </div>
  );
}

function NumberLineAnswer({
  question,
  answered,
  picked,
  onPick,
}: {
  question: Question;
  answered: boolean;
  picked: string | null;
  onPick: (value: string) => void;
}) {
  const [from, to] = question.range ?? [0, 20];
  const answer = Number(question.answer);

  // Show a window around the answer so a 0-50 line stays tappable on a phone.
  const span = Math.min(to - from, 12);
  const start = Math.max(from, Math.min(answer - Math.floor(span / 2), to - span));
  const numbers = Array.from({ length: span + 1 }, (_, i) => start + i);

  return (
    <div className="stack" style={{ marginTop: 18 }}>
      <div className="card" style={{ marginTop: 0, overflowX: 'auto' }}>
        <div className="row" style={{ gap: 6, minWidth: 'min-content', paddingBottom: 4 }}>
          {numbers.map((n) => {
            const value = String(n);
            const isAnswer = answered && n === answer;
            const isPicked = picked === value;
            return (
              <button
                key={n}
                className="chip"
                disabled={answered}
                aria-pressed={isPicked}
                onClick={() => onPick(value)}
                style={{
                  minWidth: 50,
                  minHeight: 56,
                  justifyContent: 'center',
                  fontSize: 19,
                  borderColor: isAnswer
                    ? 'var(--good)'
                    : isPicked && !isAnswer
                      ? 'var(--bad)'
                      : undefined,
                  background: isAnswer
                    ? 'color-mix(in srgb, var(--good) 22%, var(--surface-2))'
                    : undefined,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        Find the answer on the line and tap it.
      </p>
    </div>
  );
}

/* ---------------- Sort It Twice ---------------- */

function SortAnswer({
  question,
  answered,
  picked,
  onPick,
}: {
  question: Question;
  answered: boolean;
  picked: string | null;
  onPick: (value: string) => void;
}) {
  const [left, right] = question.bins ?? ['A', 'B'];

  return (
    <div className="row" style={{ marginTop: 18, gap: 12, alignItems: 'stretch' }}>
      {[left, right].map((bin) => {
        const isAnswer = answered && bin === question.answer;
        const isWrong = answered && picked === bin && bin !== question.answer;
        return (
          <button
            key={bin}
            className="card"
            disabled={answered}
            onClick={() => onPick(bin)}
            style={{
              flex: 1,
              marginTop: 0,
              minHeight: 130,
              cursor: answered ? 'default' : 'pointer',
              borderColor: isAnswer ? 'var(--good)' : isWrong ? 'var(--bad)' : 'var(--line)',
              background: isAnswer
                ? 'color-mix(in srgb, var(--good) 16%, var(--surface))'
                : isWrong
                  ? 'color-mix(in srgb, var(--bad) 16%, var(--surface))'
                  : undefined,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{bin}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Freeze! ---------------- */

/**
 * A go/no-go stream.
 *
 * Each stimulus gets a fixed window. Tapping a "go" item scores a hit; NOT
 * tapping a "no-go" item scores too — withholding is the skill being trained,
 * so it has to be worth as much as responding.
 */
function GoNoGo({
  question,
  answered,
  onDone,
}: {
  question: Question;
  answered: boolean;
  onDone: (hitRate: number) => void;
}) {
  const stimuli = question.stimuli ?? [];
  const [index, setIndex] = useState(-1);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const tapped = useRef(false);
  const finished = useRef(false);

  const WINDOW_MS = 1500;

  useEffect(() => {
    if (answered || finished.current) return;

    if (index >= stimuli.length - 1 && index >= 0) {
      finished.current = true;
      const rate = score.total ? score.correct / score.total : 0;
      window.setTimeout(() => onDone(rate), 600);
      return;
    }

    const timer = window.setTimeout(
      () => {
        // Grade the item that just elapsed before moving on.
        if (index >= 0) {
          const item = stimuli[index];
          const right = item.go ? tapped.current : !tapped.current;
          setScore((s) => ({ correct: s.correct + (right ? 1 : 0), total: s.total + 1 }));
          if (!right) setFlash('miss');
        }
        tapped.current = false;
        setFlash(null);
        setIndex((i) => i + 1);
      },
      index < 0 ? 900 : WINDOW_MS,
    );

    return () => window.clearTimeout(timer);
  }, [index, answered, stimuli, score, onDone]);

  const current = index >= 0 ? stimuli[index] : null;

  const tap = () => {
    if (tapped.current || !current) return;
    tapped.current = true;
    const right = current.go;
    setFlash(right ? 'hit' : 'miss');
    void Haptics.impact({ style: right ? ImpactStyle.Light : ImpactStyle.Heavy }).catch(
      () => undefined,
    );
  };

  return (
    <div className="stack" style={{ marginTop: 18 }}>
      <button
        onClick={tap}
        disabled={!current || answered}
        aria-label="Tap"
        style={{
          width: '100%',
          minHeight: 240,
          borderRadius: 'var(--radius-lg)',
          border: '2px solid',
          borderColor:
            flash === 'hit' ? 'var(--good)' : flash === 'miss' ? 'var(--bad)' : 'var(--line)',
          background:
            flash === 'hit'
              ? 'color-mix(in srgb, var(--good) 18%, var(--surface))'
              : flash === 'miss'
                ? 'color-mix(in srgb, var(--bad) 18%, var(--surface))'
                : 'var(--surface)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          transition: 'background 0.12s ease, border-color 0.12s ease',
        }}
      >
        <span style={{ fontSize: 96 }} aria-hidden>
          {current ? current.emoji : index < 0 ? '👀' : '✅'}
        </span>
      </button>

      <div className="row">
        <span className="badge">
          {Math.max(0, index + 1)} of {stimuli.length}
        </span>
        <span className="spacer" />
        <span className="badge badge--good">{score.correct} right</span>
      </div>

      <p className="muted" style={{ textAlign: 'center' }}>
        {index < 0 ? 'Get ready…' : 'Tap the ones that count. Sit on your hands for the rest.'}
      </p>
    </div>
  );
}

/* ---------------- Story Talk ---------------- */

/**
 * The child answers a dialogic-reading prompt out loud and it goes to the
 * parent. No marking, no score — the answer is the point.
 */
function SpeakAnswer({
  question,
  answered,
  storyId,
  onDone,
}: {
  question: Question;
  answered: boolean;
  storyId?: string;
  onDone: (value: string) => void;
}) {
  const { child, addReply } = useApp();
  const { pushReply, connected, journal } = useCloud();

  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<Recorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => {
    recorder.current?.cancel();
    clearInterval(tick.current);
  }, []);

  const start = async () => {
    if (!micSupported()) return onDone('skipped');
    try {
      const rec = new Recorder();
      rec.onLevel = setLevel;
      await rec.start();
      recorder.current = rec;
      setRecording(true);
      setElapsed(0);
      tick.current = setInterval(() => {
        setElapsed(rec.elapsed);
        if (rec.elapsed > 45) void stop();
      }, 200);
    } catch {
      onDone('skipped');
    }
  };

  const stop = async () => {
    clearInterval(tick.current);
    const result = await recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
    setLevel(0);
    if (!result || !child) return onDone('skipped');

    const audioKey = await audioStore.put(id('aud'), result.blob);
    const reply = {
      id: id('reply'),
      storyId: storyId ?? '',
      childId: child.id,
      childName: child.name,
      audioKey,
      duration: result.duration,
      createdAt: Date.now(),
    };
    addReply(reply);
    if (connected) {
      await pushReply(reply, result.blob);
      await journal({
        kind: 'talk_answered',
        summary: `${child.name} answered: "${question.prompt}"`,
        subjectId: storyId,
        actorName: child.name,
      });
    }
    onDone('answered');
  };

  if (answered) return null;

  return (
    <div className="stack" style={{ marginTop: 18 }}>
      {recording ? (
        <div className="card" style={{ marginTop: 0, textAlign: 'center' }}>
          <LevelMeter level={level} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, margin: '12px 0' }}>
            {formatDuration(elapsed)}
          </div>
          <button className="btn btn--danger btn--block btn--lg" onClick={stop}>
            I'm done
          </button>
        </div>
      ) : (
        <>
          <button className="btn btn--block btn--lg" onClick={start}>
            <IconMic size={20} /> Say my answer
          </button>
          <button className="btn btn--ghost btn--block btn--sm" onClick={() => onDone('skipped')}>
            Skip this one
          </button>
        </>
      )}
      <p className="muted" style={{ textAlign: 'center' }}>
        There is no right answer. Whatever you say goes straight to your grown-up.
      </p>
    </div>
  );
}
