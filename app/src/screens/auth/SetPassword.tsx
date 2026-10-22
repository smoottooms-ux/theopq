import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Field, PasswordInput, TopBar, useToast } from '../../components/ui';
import { checkPassword, hashAnswer, hashSecret, normaliseAnswer } from '../../lib/crypto';
import {
  CUSTOM_QUESTION,
  MIN_ANSWER_LENGTH,
  SECURITY_QUESTIONS,
} from '../../data/securityQuestions';

/**
 * Upgrades an account created before passwords existed.
 *
 * Reached only after a successful sign-in with a legacy unlock code, so the
 * person is already proven; this just stops them being left on four digits
 * with no way to recover.
 */
export default function SetPassword() {
  const navigate = useNavigate();
  const { parent, update } = useApp();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [questions, setQuestions] = useState([
    { selected: SECURITY_QUESTIONS[0], custom: '', answer: '' },
    { selected: SECURITY_QUESTIONS[2], custom: '', answer: '' },
  ]);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(
    () => checkPassword(password, [parent?.name ?? '', parent?.email.split('@')[0] ?? '']),
    [password, parent],
  );

  if (!parent) return null;

  const resolved = (q: (typeof questions)[number]) =>
    q.selected === CUSTOM_QUESTION ? q.custom.trim() : q.selected;

  const save = async () => {
    if (!strength.ok) return toast(strength.message);
    if (password !== confirm) return toast('Those passwords do not match.');
    for (const [i, q] of questions.entries()) {
      if (!resolved(q)) return toast(`Question ${i + 1} needs to say something.`);
      if (normaliseAnswer(q.answer).length < MIN_ANSWER_LENGTH) {
        return toast(`Answer ${i + 1} is too short to be any use.`);
      }
    }

    setBusy(true);
    try {
      const hashed = await hashSecret(password);
      const security = await Promise.all(
        questions.map(async (q) => ({
          question: resolved(q),
          answer: await hashAnswer(q.answer),
        })),
      );

      update((d) => {
        const i = d.parents.findIndex((p) => p.id === parent.id);
        // The old four-digit code is dropped once a real password exists.
        if (i >= 0) {
          d.parents[i] = { ...d.parents[i], password: hashed, securityQuestions: security, pin: undefined };
        }
      });

      toast('Password set.');
      navigate('/p', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Set a password" subtitle="Your account was using an old code" />

      <div className="card">
        <p className="soft">
          Accounts now use a real password, with two questions so you can get back in if you forget
          it. This takes a minute and you only do it once.
        </p>
      </div>

      <div className="card stack">
        <Field label="Password">
          <PasswordInput
            id="set-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            strength={strength}
            autoFocus
          />
        </Field>
        <Field label="Confirm">
          <PasswordInput
            id="set-confirm"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            placeholder="Type it again"
          />
        </Field>
      </div>

      <div className="section-label">If you forget it</div>
      <div className="card stack">
        {questions.map((q, i) => (
          <div key={i} className="stack" style={{ gap: 8 }}>
            <Field label={`Question ${i + 1}`}>
              <select
                id={`set-question-${i}`}
                className="select"
                value={q.selected}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, n) => (n === i ? { ...item, selected: e.target.value } : item)),
                  )
                }
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
                className="input"
                value={q.custom}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, n) => (n === i ? { ...item, custom: e.target.value } : item)),
                  )
                }
                placeholder="Your question"
              />
            )}

            <input
              id={`set-answer-${i}`}
              className="input"
              value={q.answer}
              onChange={(e) =>
                setQuestions((prev) =>
                  prev.map((item, n) => (n === i ? { ...item, answer: e.target.value } : item)),
                )
              }
              placeholder="Your answer"
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>
        ))}
      </div>

      <button className="btn btn--block btn--lg" style={{ marginTop: 14 }} onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save and continue'}
      </button>
    </div>
  );
}
