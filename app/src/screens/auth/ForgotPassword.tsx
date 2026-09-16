import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, PasswordInput, TopBar, useToast } from '../../components/ui';
import { IconCheck } from '../../components/Icons';
import { checkPassword } from '../../lib/crypto';
import {
  cloudRecoveryQuestions,
  cloudResetPassword,
  defaultServerUrl,
  loadCloudSession,
} from '../../lib/cloud';
import { HAS_HOSTED_BACKEND } from '../../lib/config';

type Step = 'email' | 'answers' | 'password' | 'done';

/**
 * Password recovery, on-device.
 *
 * There is no reset email because there is no mail server and no account
 * anywhere to send one from — recovery is the two questions the parent chose
 * at sign-up. Wrong answers are reported together and vaguely on purpose, and
 * a successful reset clears any legacy unlock code.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { recoveryQuestions, verifyRecoveryAnswers, resetPassword } = useApp();
  const toast = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '']);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Whether recovery is happening against the server or this device. */
  const [remote, setRemote] = useState(false);

  // A hosted build recovers the hosted account; a self-hosted one uses whatever
  // server this device was last signed into.
  const serverUrl = HAS_HOSTED_BACKEND ? defaultServerUrl() : (loadCloudSession()?.serverUrl ?? '');

  const strength = useMemo(() => checkPassword(password, [email.split('@')[0]]), [password, email]);

  // Guessing a pair of answers should not be something you can grind at.
  const lockedOut = attempts >= 5;

  const lookUp = async () => {
    setBusy(true);
    try {
      // The device copy is authoritative when it exists, because it works with
      // no signal; otherwise ask the server.
      const local = recoveryQuestions(email);
      if (local) {
        setRemote(false);
        setQuestions(local);
        setAnswers(local.map(() => ''));
        return setStep('answers');
      }

      if (serverUrl) {
        const found = await cloudRecoveryQuestions(serverUrl, email);
        if (found.length) {
          setRemote(true);
          setQuestions(found);
          setAnswers(found.map(() => ''));
          return setStep('answers');
        }
      }

      toast('No account can be recovered with that email.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start recovery.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (lockedOut) return;
    setBusy(true);
    try {
      // The server only verifies as part of a reset, so a remote recovery
      // collects the new password first and checks everything in one call.
      if (remote) return setStep('password');

      if (await verifyRecoveryAnswers(email, answers)) {
        setStep('password');
      } else {
        setAttempts((n) => n + 1);
        toast('Those answers do not match. Both have to be right.');
      }
    } catch {
      setAttempts((n) => n + 1);
      toast('Those answers do not match. Both have to be right.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!strength.ok) return toast(strength.message);
    if (password !== confirm) return toast('Those passwords do not match.');

    setBusy(true);
    try {
      if (remote) {
        await cloudResetPassword(serverUrl, email, answers, password);
      } else {
        await resetPassword(email, answers, password);
      }
      setStep('done');
    } catch (err) {
      setAttempts((n) => n + 1);
      toast(err instanceof Error ? err.message : 'Could not reset that password.');
      // A wrong answer only surfaces here on a remote reset, so send them back.
      if (remote) setStep('answers');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="avatar avatar--xl" style={{ margin: '0 auto 18px', color: 'var(--good)' }}>
            <IconCheck size={54} />
          </div>
          <h1>Password changed</h1>
          <p className="soft" style={{ margin: '10px auto 26px', maxWidth: 300 }}>
            Sign in with your new password.
            {remote ? ' Every other device has been signed out.' : ''}
          </p>
          <button className="btn btn--lg" onClick={() => navigate('/signin', { replace: true })}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar
        title="Forgot your password"
        subtitle={step === 'email' ? undefined : email}
        onBack={() => (step === 'email' ? navigate('/signin') : setStep('email'))}
      />

      {step === 'email' && (
        <div className="card stack">
          <Field label="Email" hint="The address you signed up with on this device.">
            <input
              id="forgot-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
            />
          </Field>
          <button className="btn btn--block" onClick={lookUp} disabled={busy || !email.trim()}>
            {busy ? 'Looking…' : 'Continue'}
          </button>
          <p className="muted">
            There is no reset email. You will be asked the two questions you chose when you signed
            up.
          </p>
        </div>
      )}

      {step === 'answers' && (
        <div className="card stack">
          {lockedOut ? (
            <>
              <h3>Too many tries</h3>
              <p className="soft">
                Close the app and come back when you are sure of the answers. Capital letters and
                spacing do not matter.
              </p>
            </>
          ) : (
            <>
              {questions.map((question, i) => (
                <Field key={i} label={question}>
                  <input
                    id={`forgot-answer-${i}`}
                    className="input"
                    value={answers[i] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => prev.map((a, n) => (n === i ? e.target.value : a)))
                    }
                    autoComplete="off"
                    autoCapitalize="none"
                    autoFocus={i === 0}
                  />
                </Field>
              ))}

              <button
                className="btn btn--block"
                onClick={verify}
                disabled={busy || answers.some((a) => !a.trim())}
              >
                {busy ? 'Checking…' : 'Check my answers'}
              </button>

              {attempts > 0 && (
                <p className="muted" style={{ color: 'var(--warn)' }}>
                  {5 - attempts} {5 - attempts === 1 ? 'try' : 'tries'} left.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {step === 'password' && (
        <div className="card stack">
          <p className="soft">
            {remote
              ? 'Choose a new password. Your answers are checked when you save.'
              : 'That is you. Choose a new password.'}
          </p>
          <Field label="New password">
            <PasswordInput
              id="forgot-password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              strength={strength}
              autoFocus
            />
          </Field>
          <Field label="Confirm">
            <PasswordInput
              id="forgot-confirm"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Type it again"
            />
          </Field>
          <button className="btn btn--block btn--lg" onClick={finish} disabled={busy}>
            {busy ? 'Saving…' : 'Set new password'}
          </button>
        </div>
      )}
    </div>
  );
}
