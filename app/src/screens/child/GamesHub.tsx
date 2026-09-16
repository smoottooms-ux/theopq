import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pendingStories, useApp } from '../../lib/store';
import { Bar, TopBar } from '../../components/ui';
import { GAMES } from '../../games';
import { minutesToday, summarise } from '../../lib/srs';

export default function GamesHub() {
  const navigate = useNavigate();
  const { data, child } = useApp();

  const skills = useMemo(() => summarise(data.cards), [data.cards]);

  if (!child) return null;

  const played = minutesToday(data.sessions, child.id);
  const cap = data.settings.dailyGameMinutes;
  const outOfTime = cap > 0 && played >= cap;

  const storyPending = pendingStories(data, child.id).length > 0;
  const storyLocked = data.settings.storyBeforeGames && storyPending;

  const tonight = data.stories
    .filter((s) => s.toChildId === child.id && s.status === 'played')
    .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))[0];

  return (
    <div className="screen">
      <TopBar title="Play & learn" onBack={() => navigate('/c')} />

      {storyLocked && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h3>Story first 🌙</h3>
          <p className="soft" style={{ marginTop: 6 }}>
            Listen to tonight's story, then the games open up.
          </p>
          <button className="btn btn--block" style={{ marginTop: 12 }} onClick={() => navigate('/c')}>
            Go to my story
          </button>
        </div>
      )}

      {outOfTime && !storyLocked && (
        <div className="card">
          <h3>That's enough for today 👏</h3>
          <p className="soft" style={{ marginTop: 6 }}>
            You played {played} minutes. Your brain needs a rest to keep what it learned.
          </p>
        </div>
      )}

      {cap > 0 && !outOfTime && (
        <div className="card">
          <Bar value={played / cap} label={`${played} of ${cap} minutes today`} />
        </div>
      )}

      <div className="section-label">Games</div>
      <div className="stack">
        {GAMES.map((game) => {
          const needsStory = game.id === 'story-recall';
          const disabled =
            storyLocked || outOfTime || (needsStory && !tonight?.comprehension.length);

          return (
            <button
              key={game.id}
              className="card"
              disabled={disabled}
              onClick={() =>
                navigate(
                  needsStory && tonight
                    ? `/c/games/${game.id}?story=${tonight.id}`
                    : `/c/games/${game.id}`,
                )
              }
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                marginTop: 0,
              }}
            >
              <div className="row">
                <div className="avatar avatar--lg" aria-hidden style={{ fontSize: 32 }}>
                  {game.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <h3>{game.title}</h3>
                  <p className="muted">
                    {needsStory && !tonight?.comprehension.length
                      ? 'Listen to a story first, then come back.'
                      : game.blurb}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="section-label">What you're getting good at</div>
      <div className="card stack">
        {skills.filter((s) => s.total > 0).length === 0 ? (
          <p className="muted">Play a round and this fills up.</p>
        ) : (
          skills
            .filter((s) => s.total > 0)
            .map((s) => <Bar key={s.skill} value={s.mastery} label={s.label} />)
        )}
      </div>
    </div>
  );
}
