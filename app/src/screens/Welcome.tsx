import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store';
import { IconMoon } from '../components/Icons';

export default function Welcome() {
  const navigate = useNavigate();
  const { data } = useApp();
  const hasAccount = data.parents.length > 0;
  const hasKids = data.children.length > 0;

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div
            style={{
              width: 92,
              height: 92,
              margin: '0 auto 22px',
              borderRadius: 30,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--accent)',
            }}
          >
            <IconMoon size={46} />
          </div>
          <h1 style={{ fontSize: 38, marginBottom: 10 }}>Story Station</h1>
          <p className="soft" style={{ maxWidth: 330, margin: '0 auto' }}>
            Bedtime happens whether you can be there or not. This is how you are still
            the one reading the story, singing the song, and teaching them something.
          </p>
        </div>
      </div>

      <div className="stack" style={{ paddingBottom: 12 }}>
        {hasKids && (
          <button className="btn btn--block btn--lg" onClick={() => navigate('/kids')}>
            🧸 I'm a kid
          </button>
        )}
        <button
          className={`btn btn--block ${hasKids ? 'btn--ghost' : 'btn--lg'}`}
          onClick={() => navigate(hasAccount ? '/signin' : '/signup')}
        >
          {hasAccount ? 'Grown-up sign in' : "I'm a grown-up — get started"}
        </button>
        {hasAccount && (
          <button className="btn btn--block btn--soft btn--sm" onClick={() => navigate('/signup')}>
            Add another grown-up
          </button>
        )}
        <button className="btn btn--ghost btn--block btn--sm" onClick={() => navigate('/pair')}>
          This is my child's device — pair it with a family code
        </button>
      </div>
    </div>
  );
}
