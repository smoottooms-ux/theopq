import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { storyLibrary, useApp } from '../../lib/store';
import { Empty, TopBar } from '../../components/ui';
import type { Story } from '../../types';
import { StoryArt } from '../../components/StoryArt';

interface Week {
  key: string;
  label: string;
  stories: Story[];
}

/** Weeks run Monday to Sunday, so "this week" means what a parent means by it. */
function groupByWeek(stories: Story[]): Week[] {
  const weeks = new Map<string, Week>();

  for (const story of stories) {
    const date = new Date(story.createdAt);
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const key = monday.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, { key, label: labelForWeek(monday), stories: [] });
    weeks.get(key)!.stories.push(story);
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
  return `${monday.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString(
    [],
    {
      day: 'numeric',
      month: 'short',
      year: monday.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    },
  )}`;
}

export default function Bookshelf() {
  const navigate = useNavigate();
  const { data, child } = useApp();

  const books = useMemo(
    () => (child ? storyLibrary(data, child.id) : []),
    [data, child],
  );

  const weeks = useMemo(() => groupByWeek(books), [books]);

  if (!child) return null;

  return (
    <div className="screen">
      <TopBar title="My books" subtitle={`${books.length} stories`} onBack={() => navigate('/c')} />

      {books.length === 0 ? (
        <Empty
          emoji="📚"
          title="Your shelf is empty"
          body="Every story you get is kept here forever. You can listen as many times as you want."
        />
      ) : (
        weeks.map((week) => (
          <div key={week.key}>
            <div className="section-label">{week.label}</div>
            <div className="grid2">
              {week.stories.map((story) => (
                <button
                  key={story.id}
                  className="card"
                  onClick={() => navigate(`/c/story/${story.id}`)}
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginTop: 0,
                  }}
                >
                  <StoryArt art={story.pages[0]?.art ?? 'moon'} seed={story.id} />
                  <div style={{ padding: 12 }}>
                    <h3 style={{ fontSize: 15, lineHeight: 1.3 }}>{story.title}</h3>
                    <p className="muted" style={{ marginTop: 4 }}>
                      {story.playCount > 0 ? `Heard ${story.playCount}×` : 'New'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {books.length > 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 22 }}>
          Nothing here ever goes away. Every story you have ever been sent is still here.
        </p>
      )}
    </div>
  );
}
