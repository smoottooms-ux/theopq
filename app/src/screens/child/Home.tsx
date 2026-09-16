import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pendingStories, storyLibrary, useApp } from '../../lib/store';
import { useCloud } from '../../lib/useCloud';
import { Empty, TopBar } from '../../components/ui';
import { IconGame, IconPlay } from '../../components/Icons';
import { StoryArt } from '../../components/StoryArt';
import { streak } from '../../lib/srs';
import { voiceDescription } from '../../lib/voice';

export default function ChildHome() {
  const navigate = useNavigate();
  const { data, child, signOut } = useApp();
  const { syncing } = useCloud({ autoSync: true });

  const waiting = useMemo(
    () => (child ? pendingStories(data, child.id) : []),
    [data, child],
  );
  const heard = useMemo(
    () => (child ? storyLibrary(data, child.id).filter((s) => s.status === 'played') : []),
    [data, child],
  );

  if (!child) return null;

  const tonight = waiting[0];
  const days = streak(data.sessions, child.id);

  return (
    <div className="screen">
      <TopBar
        title={`Hi ${child.name}!`}
        subtitle={syncing ? 'Checking for new stories…' : days > 1 ? `🔥 ${days} days in a row` : undefined}
        right={
          <button
            className="iconbtn"
            onClick={() => void signOut().then(() => navigate('/welcome'))}
            aria-label="Not me"
          >
            <span aria-hidden style={{ fontSize: 22 }}>{child.avatar}</span>
          </button>
        }
      />

      {tonight ? (
        <button
          className="card"
          onClick={() => navigate(`/c/story/${tonight.id}`)}
          style={{ width: '100%', padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ position: 'relative' }}>
            <StoryArt art={tonight.pages[0]?.art ?? 'moon'} seed={tonight.id} />
            <div
              style={{
                position: 'absolute',
                right: 16,
                bottom: -28,
                width: 68,
                height: 68,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                boxShadow: 'var(--shadow)',
              }}
            >
              <IconPlay size={30} />
            </div>
          </div>
          <div style={{ padding: '18px 16px 16px' }}>
            <span className="badge badge--accent">Tonight's story</span>
            <h2 style={{ margin: '10px 0 6px', paddingRight: 70 }}>{tonight.title}</h2>
            <p className="muted">
              {voiceDescription(tonight.voiceProvider, tonight.fromParentName)}
            </p>
          </div>
        </button>
      ) : (
        <Empty
          emoji="🌙"
          title="Nothing new yet"
          body={
            heard.length
              ? 'Your story will land at bedtime. Until then, your old books are waiting.'
              : 'When your grown-up sends a story, it shows up right here.'
          }
          action={
            heard.length > 0 ? (
              <button className="btn" onClick={() => navigate('/c/books')}>
                Open my books
              </button>
            ) : undefined
          }
        />
      )}

      {waiting.length > 1 && (
        <>
          <div className="section-label">Also waiting</div>
          <div className="stack">
            {waiting.slice(1).map((story) => (
              <button
                key={story.id}
                className="card"
                onClick={() => navigate(`/c/story/${story.id}`)}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 0 }}
              >
                <div className="row">
                  <div className="avatar" aria-hidden>📖</div>
                  <div style={{ flex: 1 }}>
                    <h3>{story.title}</h3>
                    <p className="muted">from {story.fromParentName}</p>
                  </div>
                  <IconPlay size={22} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Things to do</div>
      <button
        className="card"
        onClick={() => navigate('/c/games')}
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginTop: 0 }}
      >
        <div className="row">
          <div className="avatar avatar--lg" style={{ color: 'var(--accent-2)' }} aria-hidden>
            <IconGame size={30} />
          </div>
          <div style={{ flex: 1 }}>
            <h3>Play & learn</h3>
            <p className="muted">Words, numbers and puzzles that make you sharper.</p>
          </div>
        </div>
      </button>
    </div>
  );
}
