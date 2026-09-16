import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../lib/store';
import { Bar, TopBar } from '../../components/ui';
import { IconCheck, IconMic } from '../../components/Icons';
import { SHELF_META, recordingOrder, shelf, type ShelfKind } from '../../data/library';
import { VOICE_MINIMUM, VOICE_TARGET, voiceProgress } from '../../lib/playback';

/**
 * The parent's recording list.
 *
 * Framed around one promise: record ten short things once, and everything else
 * in the library — and every new story after it — comes out in your voice
 * without you doing anything. The songs come first because they are the
 * shortest, so the ten happen faster.
 */
export default function RecordHub() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, parent } = useApp();

  const focus = (params.get('shelf') as ShelfKind | null) ?? null;
  const progress = useMemo(() => voiceProgress(data, parent?.id), [data, parent?.id]);

  const recordedIds = new Set(
    data.recordings.filter((r) => r.parentId === parent?.id).map((r) => r.itemId),
  );

  const items = focus ? shelf(focus) : recordingOrder();
  const nextUp = recordingOrder().find((item) => !recordedIds.has(item.id));

  if (!parent) return null;

  return (
    <div className="screen">
      <TopBar
        title="Record your voice"
        subtitle={
          progress.ready
            ? 'Your voice is built — record more any time'
            : `${progress.recorded} of ${VOICE_TARGET} done`
        }
        onBack={() => navigate('/p')}
      />

      {/* ---- the deal, stated plainly ---- */}
      <div className="card">
        <div className="card__head">
          <div className="avatar" aria-hidden>{progress.ready ? '✅' : '🎙️'}</div>
          <div style={{ flex: 1 }}>
            <h3>{progress.ready ? 'Set and forget' : 'Ten short recordings'}</h3>
            <p className="muted">
              {progress.ready
                ? 'Every story and song from now on comes out in your voice automatically. You do not have to record again.'
                : 'Most are under a minute. After ten, everything else reads itself in your voice — you never record again unless you want to.'}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <Bar value={progress.recorded / VOICE_TARGET} />
          <p className="muted" style={{ marginTop: 6 }}>
            {progress.recorded === 0
              ? `Start with one. It takes about a minute.`
              : progress.recorded < VOICE_MINIMUM
                ? `${VOICE_MINIMUM - progress.recorded} more before your voice can be built at all.`
                : progress.remaining > 0
                  ? `${progress.remaining} to go. You can build your voice now, but more recordings make it sound more like you.`
                  : 'All ten done.'}
          </p>
        </div>

        {nextUp && (
          <button
            className="btn btn--block"
            style={{ marginTop: 14 }}
            onClick={() => navigate(`/p/record/${nextUp.id}`)}
          >
            <IconMic size={18} /> Record "{nextUp.title}"
          </button>
        )}

        {progress.usable >= VOICE_MINIMUM && !progress.ready && (
          <button
            className="btn btn--soft btn--block btn--sm"
            style={{ marginTop: 10 }}
            onClick={() => navigate('/p/voice')}
          >
            Build my voice from {progress.usable} recording{progress.usable === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {/* ---- shelf filter ---- */}
      <div className="chips" style={{ marginTop: 18 }}>
        <button className="chip" aria-pressed={!focus} onClick={() => navigate('/p/record')}>
          Suggested order
        </button>
        {(Object.keys(SHELF_META) as ShelfKind[]).map((kind) => (
          <button
            key={kind}
            className="chip"
            aria-pressed={focus === kind}
            onClick={() => navigate(`/p/record?shelf=${kind}`)}
          >
            <span aria-hidden>{SHELF_META[kind].emoji}</span>
            {SHELF_META[kind].label}
          </button>
        ))}
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {items.map((item) => {
          const done = recordedIds.has(item.id);
          return (
            <button
              key={item.id}
              className="card"
              onClick={() => navigate(`/p/record/${item.id}`)}
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                marginTop: 0,
                borderColor: done ? 'var(--good)' : 'var(--line)',
              }}
            >
              <div className="row">
                <div className="avatar" aria-hidden style={{ fontSize: 22 }}>
                  {done ? '✅' : item.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <h3>{item.title}</h3>
                  <p className="muted">
                    {Math.round(item.duration / 15) * 15}s · {item.teaches.split('.')[0]}
                  </p>
                </div>
                {done && (
                  <span style={{ color: 'var(--good)' }}>
                    <IconCheck size={20} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        Anything you record yourself stays exactly as you said it. Your voice is only ever copied
        for the things you have not recorded.
      </p>
    </div>
  );
}
