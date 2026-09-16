import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, PasswordInput, TopBar, useToast } from '../../components/ui';
import { checkPassword, normaliseAnswer } from '../../lib/crypto';
import {
  CUSTOM_QUESTION,
  MIN_ANSWER_LENGTH,
  SECURITY_QUESTIONS,
} from '../../data/securityQuestions';

interface QuestionChoice {
  selected: string;
  custom: string;
  answer: string;
}

export default function SignUp() {
  const navigate = useNavigate();
  const { signUpParent } = useApp();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const [questions, setQuestions] = useState<QuestionChoice[]>([
    { selected: SECURITY_QUESTIONS[0], custom: '', answer: '' },
    { selected: SECURITY_QUESTIONS[2], custom: '', answer: '' },
  ]);

  const strength = useMemo(
    () => checkPassword(password, [name, email.split('@')[0]]),
    [password, name, email],
  );

  const resolved = (q: QuestionChoice) =>
    q.selected === CUSTOM_QUESTION ? q.custom.trim() : q.selected;

  const update = (index: number, patch: Partial<QuestionChoice>) =>
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!strength.ok) return toast(strength.message);
    if (password !== confirm) return toast('Those passwords do not match.');

    for (const [i, q] of questions.entries()) {
      if (!resolved(q)) return toast(`Question ${i + 1} needs to say something.`);
      if (normaliseAnswer(q.answer).length < MIN_ANSWER_LENGTH) {
        return toast(`Answer ${i + 1} is too short to be any use.`);
      }
    }
    if (resolved(questions[0]).toLowerCase() === resolved(questions[1]).toLowerCase()) {
      return toast('Pick two different questions.');
    }

    setBusy(true);
    try {
      await signUpParent({
        name,
        email,
        password,
        questions: questions.map((q) => ({ question: resolved(q), answer: q.answer })),
      });
      navigate('/p', { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create that account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Set up your account" onBack={() => navigate('/welcome')} />

      <form className="stack" onSubmit={submit}>
        <div className="card stack">
          <Field
            label="What does your child call you?"
            hint="This is the name they will see and hear. Dad, Mum, Papa, Nana — whatever they actually say."
          >
            <input
              id="signup-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dad"
              autoComplete="name"
              required
            />
          </Field>

          <Field label="Email" hint="Used to sign back in, and to recover your password.">
            <input
              id="signup-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="none"
              required
            />
          </Field>
        </div>

        <div className="card stack">
          <Field label="Password">
            <PasswordInput
              id="signup-password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              strength={strength}
            />
          </Field>
          <Field label="Confirm password">
            <PasswordInput
              id="signup-confirm"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Type it again"
            />
          </Field>
        </div>

        <div className="section-label">If you forget it</div>
        <div className="card stack">
          <p className="muted">
            Two questions only you can answer. There is no email reset — nothing leaves this
            device — so pick things you will still know in two years.
          </p>

          {questions.map((q, i) => (
            <div key={i} className="stack" style={{ gap: 8 }}>
              <Field label={`Question ${i + 1}`}>
                <select
                  id={`signup-question-${i}`}
                  className="select"
                  value={q.selected}
                  onChange={(e) => update(i, { selected: e.target.value })}
                >
                  {SECURITY_QUESTIONS.map((question) => (
                    <option key={question} value={question}>
                      {question}
                    </option>
                  ))}
                  <option value={CUSTOM_QUESTION}>Write my own question…</option>
                </select>
              </Field>

              {q.selected === CUSTOM_QUESTION && (
                <input
                  id={`signup-custom-${i}`}
                  className="input"
                  value={q.custom}
                  onChange={(e) => update(i, { custom: e.target.value })}
                  placeholder="Your question"
                />
              )}

              <input
                id={`signup-answer-${i}`}
                className="input"
                value={q.answer}
                onChange={(e) => update(i, { answer: e.target.value })}
                placeholder="Your answer"
                autoComplete="off"
                autoCapitalize="none"
              />
            </div>
          ))}

          <p className="muted">
            Capital letters and spacing do not matter when you answer these later.
          </p>
        </div>

        <button className="btn btn--block btn--lg" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <p className="muted" style={{ textAlign: 'center' }}>
          Your password and answers are scrambled before they are saved. Nobody can read them back,
          including us.
        </p>
      </form>
    </div>
  );
}
