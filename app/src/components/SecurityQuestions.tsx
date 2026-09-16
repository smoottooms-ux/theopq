import { useState } from 'react';
import { Field } from './ui';
import { CUSTOM_QUESTION, SECURITY_QUESTIONS } from '../data/securityQuestions';

export interface QuestionChoice {
  selected: string;
  custom: string;
  answer: string;
}

export const emptyQuestions = (): QuestionChoice[] => [
  { selected: SECURITY_QUESTIONS[0], custom: '', answer: '' },
  { selected: SECURITY_QUESTIONS[2], custom: '', answer: '' },
];

export const resolveQuestion = (q: QuestionChoice): string =>
  q.selected === CUSTOM_QUESTION ? q.custom.trim() : q.selected;

/**
 * The two-question recovery picker.
 *
 * Shared between the on-device account and the hosted one so a parent sees the
 * same thing either way, and so the validation rules can only be written once.
 */
export function SecurityQuestionFields({
  value,
  onChange,
  idPrefix,
}: {
  value: QuestionChoice[];
  onChange: (next: QuestionChoice[]) => void;
  idPrefix: string;
}) {
  const [touched, setTouched] = useState(false);

  const patch = (index: number, changes: Partial<QuestionChoice>) => {
    setTouched(true);
    onChange(value.map((q, i) => (i === index ? { ...q, ...changes } : q)));
  };

  const duplicate =
    touched &&
    resolveQuestion(value[0]).toLowerCase() === resolveQuestion(value[1]).toLowerCase() &&
    !!resolveQuestion(value[0]);

  return (
    <>
      {value.map((q, i) => (
        <div key={i} className="stack" style={{ gap: 8 }}>
          <Field label={`Question ${i + 1}`}>
            <select
              id={`${idPrefix}-question-${i}`}
              className="select"
              value={q.selected}
              onChange={(e) => patch(i, { selected: e.target.value })}
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
              id={`${idPrefix}-custom-${i}`}
              className="input"
              value={q.custom}
              onChange={(e) => patch(i, { custom: e.target.value })}
              placeholder="Your question"
            />
          )}

          <input
            id={`${idPrefix}-answer-${i}`}
            className="input"
            value={q.answer}
            onChange={(e) => patch(i, { answer: e.target.value })}
            placeholder="Your answer"
            autoComplete="off"
            autoCapitalize="none"
          />
        </div>
      ))}

      {duplicate && (
        <p className="muted" style={{ color: 'var(--warn)' }}>
          Pick two different questions.
        </p>
      )}

      <p className="muted">
        Capital letters and spacing do not matter when you answer these later.
      </p>
    </>
  );
}
