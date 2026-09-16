import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Bar, Empty, TopBar } from '../../components/ui';
import { accuracy, minutesToday, streak, summarise } from '../../lib/srs';

export default function ProgressScreen() {
  const navigate = useNavigate();
  const { data } = useApp();
  const [childId, setChildId] = useState(data.children[0]?.id ?? '');

  const child = data.children.find((c) => c.id === childId);

  const cards = useMemo(
    () => data.cards.filter(() => true),
    [data.cards],
  );

  const skills = useMemo(() => summarise(cards), [cards]);
  const sessions = useMemo(
    () => data.sessions.filter((s) => s.childId === childId),
    [data.sessions, childId],
  );

  const storiesPlayed = data.stories.filter(
    (s) => s.toChildId === childId && s.status === 'played',
  );

  if (!child) {
    return (
      <div className="screen">
        <TopBar title="Progress" onBack={() => navigate('/p')} />
        <Empty emoji="📊" title="No children yet" body="Add a child to start tracking what sticks." />
      </div>
    );
  }

  const totalMs = sessions.reduce((n, s) => n + s.ms, 0);
  // A 40-second round is real play; rounding it to "0 min" reads as a bug.
  const totalPlayed =
    totalMs === 0 ? '0' : totalMs < 60_000 ? '<1' : String(Math.round(totalMs / 60_000));
  const overall = accuracy(data.sessions, childId);

  return (
    <div className="screen">
      <TopBar title="Progress" subtitle="What is actually sticking" onBack={() => navigate('/p')} />

      {data.children.length > 1 && (
        <div className="chips" style={{ marginBottom: 16 }}>
          {data.children.map((kid) => (
            <button
              key={kid.id}
              className="chip"
              aria-pressed={childId === kid.id}
              onClick={() => setChildId(kid.id)}
            >
              <span aria-hidden>{kid.avatar}</span>
              {kid.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid2">
        <Stat label="Day streak" value={String(streak(data.sessions, childId))} suffix="days" />
        <Stat label="Stories heard" value={String(storiesPlayed.length)} />
        <Stat label="Answers right" value={`${Math.round(overall * 100)}%`} />
        <Stat label="Time playing" value={totalPlayed} suffix="min total" />
      </div>

      <div className="section-label">Skills</div>
      <div className="card stack">
        {skills.every((s) => s.total === 0) ? (
          <p className="muted">
            Nothing to show yet. Once {child.name} plays a few rounds, this fills in with what they
            have genuinely retained — not just what they tapped today.
          </p>
        ) : (
          skills
            .filter((s) => s.total > 0)
            .map((s) => (
              <div key={s.skill}>
                <Bar value={s.mastery} label={s.label} />
                <p className="muted" style={{ marginTop: 4 }}>
                  {s.mastered} mastered · {s.learning} still learning · {s.total} seen
                </p>
              </div>
            ))
        )}
      </div>

      <div className="section-label">Today</div>
      <div className="card">
        <div className="row">
          <div style={{ flex: 1 }}>
            <h3>{describeToday(minutesToday(data.sessions, childId), totalMs)}</h3>
            <p className="muted">
              {data.settings.dailyGameMinutes > 0
                ? `Daily cap is ${data.settings.dailyGameMinutes} min.`
                : 'No daily cap set.'}
            </p>
          </div>
        </div>
        {data.settings.dailyGameMinutes > 0 && (
          <div style={{ marginTop: 10 }}>
            <Bar value={minutesToday(data.sessions, childId) / data.settings.dailyGameMinutes} />
          </div>
        )}
      </div>

      <div className="section-label">Recent rounds</div>
      {sessions.length === 0 ? (
        <Empty emoji="🎲" title="No rounds yet" body={`${child.name} has not played anything.`} />
      ) : (
        <div className="stack">
          {sessions.slice(0, 12).map((s) => (
            <div key={s.id} className="card" style={{ marginTop: 0 }}>
              <div className="row">
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15 }}>{s.game}</h3>
                  <p className="muted">
                    {new Date(s.createdAt).toLocaleString([], {
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span
                  className={`badge ${
                    s.total && s.correct / s.total >= 0.8
                      ? 'badge--good'
                      : s.total && s.correct / s.total >= 0.5
                        ? 'badge--warn'
                        : 'badge--bad'
                  }`}
                >
                  {s.correct}/{s.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Reads naturally for a first short session as well as a long week. */
function describeToday(minutes: number, totalMs: number): string {
  if (minutes > 0) return `${minutes} min played today`;
  return totalMs > 0 ? 'Under a minute today' : 'Nothing played today';
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </div>
      {suffix && <div className="muted">{suffix}</div>}
    </div>
  );
}
