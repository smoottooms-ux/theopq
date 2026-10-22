import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, TopBar, useToast } from '../../components/ui';
import { normaliseAnswer } from '../../lib/crypto';
import { MIN_ANSWER_LENGTH } from '../../data/securityQuestions';

/**
 * Getting back in.
 *
 * There is no password. An account on this device is one tap away, because the
 * data is already here and asking a tired parent to retype something at 9pm
 * protects nothing — the parent/child boundary is the child's own PIN. The two
 * security answers are for a different phone, or a second account on this one.
 */
export default function SignIn() {
  const navigate = useNavigate();
  const { signInParent, continueAsParent, localParents, recoveryQuestions } = useApp();
  const toast = useToast();

  const accounts = localParents();
  const [email, setEmail] = useState(accounts[0]?.email ?? '');
  const [answers, setAnswers] = useState(['', '']);
  const [askingQuestions, setAskingQuestions] = useState(accounts.length === 0);
  const [busy, setBusy] = useState(false);

  const questions = useMemo(() => recoveryQuestions(email) ?? [], [email, recoveryQuestions]);

  const enter = async (parentId: string) => {
    setBusy(true);
    try {
      await continueAsParent(parentId);
      navigate('/p', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open that account.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (answers.some((a) => normaliseAnswer(a).length < MIN_ANSWER_LENGTH)) {
      return toast('Both answers are needed.');
    }
    setBusy(true);
    try {
      await signInParent(email, answers);
      navigate('/p', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not sign in.');
      setAnswers(['', '']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Welcome back" onBack={() => navigate('/welcome')} />

      {accounts.length > 0 && !askingQuestions && (
        <div className="card stack">
          <h3>Tap your name to carry on</h3>
          {accounts.map((a) => (
            <button
              key={a.id}
              className="btn btn--block btn--lg"
              disabled={busy}
              onClick={() => void enter(a.id)}
            >
              {a.name}
            </button>
          ))}
          <p className="muted" style={{ textAlign: 'center' }}>
            Your recordings and stories are already on this phone.
          </p>
          <button
            className="btn btn--ghost btn--block btn--sm"
            onClick={() => setAskingQuestions(true)}
          >
            Use my email and security questions instead
          </button>
        </div>
      )}

      {askingQuestions && (
        <>
          <form className="card stack" onSubmit={submit}>
            <Field label="Email">
              <input
                id="signin-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                required
              />
            </Field>

            {questions.length >= 2 ? (
              questions.map((q, i) => (
                <Field key={i} label={q}>
                  <input
                    id={`signin-answer-${i}`}
                    className="input"
                    value={answers[i] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
                    }
                    placeholder="Your answer"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </Field>
              ))
            ) : (
              <p className="muted">
                Type the email you signed up with. Your two questions appear here once it
                matches an account on this phone.
              </p>
            )}

            <button className="btn btn--block" disabled={busy || questions.length < 2}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>

          {accounts.length > 0 && (
            <button
              className="btn btn--ghost btn--block btn--sm"
              style={{ marginTop: 12 }}
              onClick={() => setAskingQuestions(false)}
            >
              Back
            </button>
          )}
        </>
      )}

      <button
        className="btn btn--soft btn--block btn--sm"
        style={{ marginTop: 8 }}
        onClick={() => navigate('/signup')}
      >
        Create a different account
      </button>
    </div>
  );
}
