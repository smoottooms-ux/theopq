import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { StoryArt } from '../components/StoryArt';

/**
 * The first-run walkthrough.
 *
 * Written on the assumption that the reader is tired, holding a phone in one
 * hand, and will leave if a screen looks like homework. So: one idea per
 * screen, one sentence, one big button, and a visible way out on every step.
 * Nothing here explains a feature — each card answers "what do I do next".
 */

interface Step {
  art: string;
  emoji: string;
  title: string;
  body: string;
  /** The single thing this screen wants the reader to understand. */
  point: string;
  cta: string;
}

const STEPS: Step[] = [
  {
    art: 'moon',
    emoji: '🌙',
    title: 'You read the bedtime story',
    body: "Even when you can't be there.",
    point:
      'At work, on the road, in the next room with your hands full, or just out of energy — your child still hears your voice at bedtime.',
    cta: 'How?',
  },
  {
    art: 'note',
    emoji: '🎙️',
    title: 'Record ten short songs',
    body: 'Most are under a minute.',
    point: 'That is the only recording you ever have to do. We will show you exactly which ones.',
    cta: 'Then what?',
  },
  {
    art: 'lamp',
    emoji: '✨',
    title: 'Then it runs itself',
    body: 'Every story, every song, in your voice.',
    point: 'You pick a topic or let it choose. It sends one every night on its own.',
    cta: 'What do they see?',
  },
  {
    art: 'friend',
    emoji: '📖',
    title: 'They watch the words light up',
    body: 'Like your finger under the line.',
    point: 'Stories, learning books and songs — the words glow as your voice reads them.',
    cta: 'And the games?',
  },
  {
    art: 'meadow',
    emoji: '🧠',
    title: 'Games that actually teach',
    body: "For the nights they're still bouncing.",
    point:
      'Letter sounds, counting, and stopping-and-thinking — the winding-down kind, not the winding-up kind. No ads, nothing to buy, nothing to win.',
    cta: "Let's set it up",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { data, setSettings } = useApp();
  const [index, setIndex] = useState(0);

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = () => {
    setSettings({ onboarded: true });
    navigate(data.parents.length > 0 ? '/signin' : '/signup', { replace: true });
  };

  const skip = () => {
    setSettings({ onboarded: true });
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="row" style={{ justifyContent: 'flex-end', minHeight: 44 }}>
        <button
          className="btn btn--ghost btn--sm"
          onClick={skip}
          style={{ border: 'none', color: 'var(--ink-mute)' }}
        >
          Skip
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <StoryArt art={step.art} seed={`onboard-${index}`} />
        </div>

        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <div style={{ fontSize: 40 }} aria-hidden>
            {step.emoji}
          </div>
          <h1 style={{ fontSize: 30, marginTop: 10, textWrap: 'balance' }}>{step.title}</h1>
          <p
            className="soft"
            style={{ fontSize: 19, marginTop: 8, fontFamily: 'var(--font-display)' }}
          >
            {step.body}
          </p>
          <p className="muted" style={{ maxWidth: 320, margin: '16px auto 0', lineHeight: 1.6 }}>
            {step.point}
          </p>
        </div>
      </div>

      <div className="stack" style={{ paddingBottom: 8 }}>
        <div className="row" style={{ justifyContent: 'center', gap: 6, marginBottom: 10 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? 22 : 7,
                height: 7,
                borderRadius: 999,
                background: i === index ? 'var(--accent)' : 'var(--line)',
                transition: 'width 0.2s ease',
              }}
            />
          ))}
        </div>

        <button
          className="btn btn--block btn--lg"
          onClick={() => (last ? finish() : setIndex((n) => n + 1))}
        >
          {step.cta}
        </button>

        {index > 0 && (
          <button
            className="btn btn--ghost btn--block btn--sm"
            onClick={() => setIndex((n) => n - 1)}
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
