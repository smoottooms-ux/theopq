import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Empty, TopBar } from '../../components/ui';
import { IconRefresh } from '../../components/Icons';
import type { JournalEntry, Story } from '../../types';

/**
 * The family archive.
 *
 * Grouped by week and never pruned. The point is that in four years a parent
 * can scroll back to the week they were in Carlisle and find the exact story
 * they sent, and whether their kid listened to it twice.
 */
export default function JournalScreen() {
  const navigate = useNavigate();
  const { data } = useApp();
  const { syncNow, syncing, connected } = useCloud();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Local stories and lullabies are folded in so the archive is complete even
  // on a device that has never synced.
  const entries = useMemo(() => buildEntries(data.journal, data.stories, data.lullabies), [data]);
  const weeks = useMemo(() => groupByWeek(entries), [entries]);

  return (
    <div className="screen">
      <TopBar
        title="Archive"
        subtitle={`${entries.length} nights recorded`}
        onBack={() => navigate('/p')}
        right={
          connected ? (
            <button className="iconbtn" onClick={() => void syncNow()} aria-label="Refresh">
              <IconRefresh className={syncing ? 'spin' : undefined} />
            </button>
          ) : undefined
        }
      />

      {weeks.length === 0 ? (
        <Empty
          emoji="📔"
          title="Nothing yet"
          body="Every story you send, every one they play, and every message back gets written down here — permanently."
        />
      ) : (
        weeks.map((week) => (
          <div key={week.key}>
            <button
              className="section-label"
              onClick={() => setExpanded(expanded === week.key ? null : week.key)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {week.label} · {week.entries.length}
            </button>

            <div className="stack">
              {week.entries.map((entry) => (
                <div key={entry.id} className="card" style={{ marginTop: 0 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div className="avatar" aria-hidden>{ICONS[entry.kind] ?? '•'}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, lineHeight: 1.4 }}>
                        {entry.summary}
                      </p>
                      <p className="muted" style={{ marginTop: 4 }}>
                        {new Date(entry.createdAt).toLocaleString([], {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <p className="muted" style={{ textAlign: 'center', marginTop: 22 }}>
        Nothing here is ever deleted automatically. These are the nights you were not there — they
        are worth keeping.
      </p>
    </div>
  );
}

const ICONS: Record<string, string> = {
  story_sent: '📖',
  story_played: '▶️',
  lullaby_sent: '🎵',
  reply_sent: '💌',
  reply_heard: '👂',
  voice_ready: '🎙️',
  child_added: '🧸',
  game_played: '🎲',
  talk_answered: '💬',
  plan_changed: '💳',
};

/** Merges the synced journal with anything only this device knows about. */
function buildEntries(
  journal: JournalEntry[],
  stories: Story[],
  lullabies: { id: string; title: string; createdAt: number; fromParentName: string }[],
): JournalEntry[] {
  const known = new Set(journal.map((e) => e.subjectId).filter(Boolean));
  const extra: JournalEntry[] = [];

  for (const story of stories) {
    if (known.has(story.id) || story.status === 'draft') continue;
    extra.push({
      id: `local:${story.id}`,
      kind: 'story_sent',
      summary: `Sent "${story.title}"`,
      createdAt: story.createdAt,
      subjectId: story.id,
    });
  }

  for (const lullaby of lullabies) {
    if (known.has(lullaby.id)) continue;
    extra.push({
      id: `local:${lullaby.id}`,
      kind: 'lullaby_sent',
      summary: `Sent the lullaby "${lullaby.title}"`,
      createdAt: lullaby.createdAt,
      subjectId: lullaby.id,
    });
  }

  return [...journal, ...extra].sort((a, b) => b.createdAt - a.createdAt);
}

interface Week {
  key: string;
  label: string;
  entries: JournalEntry[];
}

/** Weeks run Monday to Sunday, which is how people actually talk about them. */
function groupByWeek(entries: JournalEntry[]): Week[] {
  const weeks = new Map<string, Week>();

  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const monday = new Date(date);
    const offset = (date.getDay() + 6) % 7;
    monday.setDate(date.getDate() - offset);
    monday.setHours(0, 0, 0, 0);

    const key = monday.toISOString().slice(0, 10);
    if (!weeks.has(key)) {
      weeks.set(key, { key, label: labelForWeek(monday), entries: [] });
    }
    weeks.get(key)!.entries.push(entry);
  }

  return [...weeks.values()];
}

function labelForWeek(monday: Date): string {
  const thisMonday = new Date();
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
  thisMonday.setHours(0, 0, 0, 0);

  const weeksAgo = Math.round((thisMonday.getTime() - monday.getTime()) / (7 * 86_400_000));
  if (weeksAgo === 0) return 'This week';
  if (weeksAgo === 1) return 'Last week';

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const sameMonth = monday.getMonth() === sunday.getMonth();
  const start = monday.toLocaleDateString([], { day: 'numeric', month: sameMonth ? undefined : 'short' });
  const end = sunday.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: monday.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
  return `${start} – ${end}`;
}
