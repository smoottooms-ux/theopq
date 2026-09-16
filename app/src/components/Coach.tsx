import type { ReactNode } from 'react';
import { useApp } from '../lib/store';

/**
 * An inline instruction that appears exactly where the next action is.
 *
 * A walkthrough at the start is forgotten by the time it matters, so the
 * important sentences live on the screen they describe — and disappear once
 * the thing they explain has been done.
 */
export function Coach({
  when,
  title,
  children,
  action,
}: {
  /** Shown only while this is true. */
  when: boolean;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  if (!when) return null;

  return (
    <div
      className="card"
      style={{
        borderColor: 'var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="avatar" aria-hidden>👉</div>
        <div style={{ flex: 1 }}>
          <h3>{title}</h3>
          <p className="soft" style={{ marginTop: 6 }}>{children}</p>
          {action && <div style={{ marginTop: 12 }}>{action}</div>}
        </div>
      </div>
    </div>
  );
}

/** Convenience: has this parent done the thing yet? */
export function useFirstRun() {
  const { data, parent } = useApp();
  const recordings = data.recordings.filter((r) => r.parentId === parent?.id);
  const voice = data.voices.find((v) => v.parentId === parent?.id);

  return {
    noChildren: data.children.length === 0,
    noRecordings: recordings.length === 0,
    voiceNotBuilt: voice?.status !== 'ready',
    noStoriesSent: data.stories.length === 0,
  };
}
