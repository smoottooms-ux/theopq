import { useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { TopBar } from '../../components/ui';
import { StoryArt } from '../../components/StoryArt';
import { shelf } from '../../data/library';
import { chooseVoice } from '../../lib/playback';

/** Learning books and songs, on one shelf for the child. */
export default function LearningHub() {
  const navigate = useNavigate();
  const { data, child } = useApp();

  if (!child) return null;

  const sections = [
    { kind: 'learning-book' as const, label: 'Books that teach', emoji: '📚' },
    { kind: 'song' as const, label: 'Songs that teach', emoji: '🎵' },
  ];

  return (
    <div className="screen">
      <TopBar title="Learning" subtitle="Books and songs that teach you something" />

      {sections.map((section) => (
        <div key={section.kind}>
          <div className="section-label">
            {section.emoji} {section.label}
          </div>
          <div className="grid2">
            {shelf(section.kind).map((item) => {
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
                  <StoryArt art={item.pages[0]?.art ?? 'meadow'} seed={item.id} />
                  <div style={{ padding: 12 }}>
                    <h3 style={{ fontSize: 15, lineHeight: 1.3 }}>
                      <span aria-hidden>{item.emoji} </span>
                      {item.title}
                    </h3>
                    <p className="muted" style={{ marginTop: 4 }}>
                      {inParentVoice ? `💛 ${voice.label}` : item.blurb}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
