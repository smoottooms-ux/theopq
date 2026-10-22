import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Field, PasswordInput, TopBar, useToast } from '../../components/ui';
import {
  SecurityQuestionFields,
  emptyQuestions,
  resolveQuestion,
  type QuestionChoice,
} from '../../components/SecurityQuestions';
import { checkPassword, normaliseAnswer } from '../../lib/crypto';
import { MIN_ANSWER_LENGTH } from '../../data/securityQuestions';
import { IconCheck, IconRefresh } from '../../components/Icons';
import { cloudSignIn, cloudSignUp, defaultServerUrl, pushChild } from '../../lib/cloud';
import { HAS_HOSTED_BACKEND } from '../../lib/config';

/**
 * The Story Station account.
 *
 * There is exactly one account in this product and it is ours. No API keys, no
 * third-party sign-ups, no "create an ElevenLabs account first" — that is the
 * difference between something you can sell and something you can only demo.
 */
export default function AccountScreen() {
  const navigate = useNavigate();
  const { data, parent } = useApp();
  const { cloud, connected, account, syncing, lastSync, error, connect, disconnect, syncNow } =
    useCloud();
  const toast = useToast();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState(parent?.email ?? '');
  const [questions, setQuestions] = useState<QuestionChoice[]>(emptyQuestions);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const strength = useMemo(
    () => checkPassword(password, [parent?.name ?? '', email.split('@')[0]]),
    [password, parent, email],
  );

  const submit = async () => {
    if (!parent) return;

    if (mode === 'signup') {
      if (!strength.ok) return toast(strength.message);
      for (const [i, q] of questions.entries()) {
        if (!resolveQuestion(q)) return toast(`Question ${i + 1} needs to say something.`);
        if (normaliseAnswer(q.answer).length < MIN_ANSWER_LENGTH) {
          return toast(`Answer ${i + 1} is too short to be any use.`);
        }
      }
      if (
        resolveQuestion(questions[0]).toLowerCase() === resolveQuestion(questions[1]).toLowerCase()
      ) {
        return toast('Pick two different questions.');
      }
    }

    setBusy(true);
    try {
      const target = defaultServerUrl();

      const result =
        mode === 'signup'
          ? await cloudSignUp(target, {
              name: parent.name,
              email,
              password,
              questions: questions.map((q) => ({
                question: resolveQuestion(q),
                answer: q.answer,
              })),
            })
          : await cloudSignIn(target, email, password);

      connect(result.session);

      // Upload the children so their devices can pair straight away.
      for (const child of data.children) {
        await pushChild(result.session, child, child.pin).catch(() => undefined);
      }

      toast(`You're in. Family code: ${result.joinCode}`);
      setPassword('');
      navigate('/p/plan');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * A build with no server has nothing to sign in to, so it says so instead of
   * showing a form that cannot work. This screen used to ask for a server
   * address, which is a question no parent can answer, and submitting it
   * produced a JSON parse error from the app's own index.html.
   */
  if (!HAS_HOSTED_BACKEND) {
    return (
      <div className="screen">
        <TopBar title="Your account" onBack={() => navigate('/p/settings')} />

        <div className="card">
          <div className="avatar avatar--lg" style={{ margin: '0 auto 12px', color: 'var(--good)' }}>
            <IconCheck size={36} />
          </div>
          <h2 style={{ textAlign: 'center' }}>No account needed</h2>
          <p className="muted" style={{ marginTop: 8, textAlign: 'center' }}>
            This copy of Story Station runs entirely on your phone. Your recordings, your
            stories and your children never leave the device, and there is nothing to sign
            in to.
          </p>
        </div>

        <div className="card">
          <h3>What works right now</h3>
          <ul className="soft" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Everything you record plays back in your real voice.</li>
            <li>Every story is kept, week by week, forever.</li>
            <li>Bedtime stories, lullabies, learning books and the games.</li>
          </ul>
        </div>

        <div className="card">
          <h3>Your family code</h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Type this into your child's device, with their own 4-digit code, to pair it.
          </p>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 40,
              letterSpacing: '0.18em',
              textAlign: 'center',
              margin: '16px 0 6px',
              color: 'var(--accent)',
            }}
          >
            {data.family?.joinCode ?? '——————'}
          </div>
        </div>
      </div>
    );
  }

  if (connected && cloud) {
    return (
      <div className="screen">
        <TopBar title="Your account" onBack={() => navigate('/p/settings')} />

        <div className="card" style={{ textAlign: 'center' }}>
          <div className="avatar avatar--lg" style={{ margin: '0 auto 12px', color: 'var(--good)' }}>
            <IconCheck size={36} />
          </div>
          <h2>Signed in</h2>
          <p className="muted" style={{ marginTop: 6 }}>{parent?.email}</p>
          {account && (
            <p className="muted" style={{ marginTop: 4 }}>
              {account.entitlement.planLabel}
            </p>
          )}
          {lastSync && (
            <p className="muted" style={{ marginTop: 4 }}>
              Last synced {new Date(lastSync).toLocaleTimeString()}
            </p>
          )}
          {error && <p className="muted" style={{ color: 'var(--warn)', marginTop: 8 }}>⚠ {error}</p>}
        </div>

        <div className="card">
          <h3>Your family code</h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Type this into your child's device once, with their own 4-digit code, and their tablet is
            paired to your account for good.
          </p>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 40,
              letterSpacing: '0.18em',
              textAlign: 'center',
              margin: '16px 0 6px',
              color: 'var(--accent)',
            }}
          >
            {cloud.joinCode}
          </div>
        </div>

        <div className="card stack">
          <button className="btn btn--block" onClick={() => navigate('/p/plan')}>
            See my plan
          </button>
          <button className="btn btn--soft btn--block" onClick={() => void syncNow()} disabled={syncing}>
            <IconRefresh size={18} className={syncing ? 'spin' : undefined} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            className="btn btn--ghost btn--block btn--sm"
            onClick={() => {
              disconnect();
              toast('Signed out of your Story Station account on this device.');
            }}
          >
            Sign out of this device
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar
        title={mode === 'signup' ? 'Create your account' : 'Sign in'}
        onBack={() => navigate('/p/settings')}
      />

      <div className="card">
        <h3>What an account gets you</h3>
        <ul className="soft" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Your voice, built for you — nothing else to sign up for.</li>
          <li>Stories land on your child's device wherever you are.</li>
          <li>Every story kept forever, week by week.</li>
        </ul>
      </div>

      <div className="card stack">
        <div className="chips">
          <button className="chip" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
            I'm new
          </button>
          <button className="chip" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>
            I have an account
          </button>
        </div>

        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Password">
          <PasswordInput
            id="account-password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            strength={mode === 'signup' ? strength : null}
          />
        </Field>

        {mode === 'signup' && (
          <>
            <div className="section-label" style={{ marginTop: 4 }}>
              If you forget it
            </div>
            <SecurityQuestionFields value={questions} onChange={setQuestions} idPrefix="account" />
          </>
        )}

        <button
          className="btn btn--block btn--lg"
          onClick={submit}
          disabled={busy || !password || !email.trim()}
        >
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account — free trial' : 'Sign in'}
        </button>

        {mode === 'signup' && (
          <p className="muted" style={{ textAlign: 'center' }}>
            Free for two weeks. No card needed to start.
          </p>
        )}
      </div>
    </div>
  );
}
