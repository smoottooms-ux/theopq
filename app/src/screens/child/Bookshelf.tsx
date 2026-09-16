import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { storyLibrary, useApp } from '../../lib/store';
import { Empty, TopBar } from '../../components/ui';
import { StoryArt } from '../../components/StoryArt';

export default function Bookshelf() {
  const navigate = useNavigate();
  const { data, child } = useApp();

  const books = useMemo(
    () => (child ? storyLibrary(data, child.id) : []),
    [data, child],
  );

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
        <div className="grid2">
          {books.map((story) => (
            <button
              key={story.id}
              className="card"
              onClick={() => navigate(`/c/story/${story.id}`)}
              style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', marginTop: 0 }}
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
      )}
    </div>
  );
}
