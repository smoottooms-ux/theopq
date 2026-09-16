import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Empty, TopBar } from '../../components/ui';
import { StoryArt } from '../../components/StoryArt';
import { SHELF_META, shelf, type ShelfKind } from '../../data/library';
import { chooseVoice } from '../../lib/playback';

/** One shelf of the library, as a child sees it. */
export default function Shelf() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const { data, child } = useApp();

  const shelfKind = (kind ?? 'story') as ShelfKind;
  const meta = SHELF_META[shelfKind];
  const items = useMemo(() => shelf(shelfKind), [shelfKind]);

  if (!child || !meta) return null;

  return (
    <div className="screen">
      <TopBar title={meta.label} subtitle={meta.blurb} onBack={() => navigate('/c')} />

      {items.length === 0 ? (
        <Empty emoji="📚" title="Nothing here yet" />
      ) : (
        <div className="grid2">
          {items.map((item) => {
            const voice = chooseVoice(data, item);
            const inParentVoice = voice.kind !== 'device';

            return (
              <button
                key={item.id}
                className="card"
                onClick={() => navigate(`/c/read/${item.id}`)}
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginTop: 0,
                  borderColor: inParentVoice ? 'var(--accent)' : 'var(--line)',
                }}
              >
                <StoryArt art={item.pages[0]?.art ?? 'moon'} seed={item.id} />
                <div style={{ padding: 12 }}>
                  <h3 style={{ fontSize: 15, lineHeight: 1.3 }}>
                    <span aria-hidden>{item.emoji} </span>
                    {item.title}
                  </h3>
                  <p className="muted" style={{ marginTop: 4 }}>
                    {inParentVoice ? `💛 ${voice.label}` : `${Math.round(item.duration / 60)} min`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
