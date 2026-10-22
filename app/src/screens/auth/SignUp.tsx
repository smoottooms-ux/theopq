import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, TopBar, useToast } from '../../components/ui';
import { normaliseAnswer } from '../../lib/crypto';
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
  const [busy, setBusy] = useState(false);

  const [questions, setQuestions] = useState<QuestionChoice[]>([
    { selected: SECURITY_QUESTIONS[0], custom: '', answer: '' },
    { selected: SECURITY_QUESTIONS[2], custom: '', answer: '' },
  ]);

  const resolved = (q: QuestionChoice) =>
    q.selected === CUSTOM_QUESTION ? q.custom.trim() : q.selected;

  const update = (index: number, patch: Partial<QuestionChoice>) =>
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();

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
            hint="However they say it: Mum, Dad, Mama, Papa, Nana, Grandad, or your first name. It is what they will see and hear."
          >
            <input
              id="signup-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What they call you"
              autoComplete="name"
              required
            />
          </Field>

          <Field label="Email" hint="Used to sign back in. Nothing is ever sent to it.">
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

        <div className="section-label">How you get back in</div>
        <div className="card stack">
          <p className="muted">
            No password. Two questions only you can answer instead — they are what let you
            back in on a new phone, so pick things you will still know in two years.
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
          Your answers are scrambled before they are saved. Nobody can read them back,
          including us.
        </p>
      </form>
    </div>
  );
}
