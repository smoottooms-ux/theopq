import { useEffect, useMemo, useRef, useState } from 'react';
import { StoryArt } from './StoryArt';
import { tokenisePage, wordAt, type ReadAlongScript } from '../lib/readalong';

/**
 * A book that reads itself.
 *
 * The page shows the words, and the word currently being spoken is lit up, the
 * way a finger moves along the line when somebody reads to you properly. Pages
 * turn themselves in time with the voice, and a reader who wants to look at
 * the picture for a minute can turn them by hand without the audio arguing.
 */
export function ReadAlongBook({
  script,
  seed,
  arts,
  currentTime,
  activeWord,
  page,
  onPageChange,
  onSeekToPage,
  playing,
}: {
  script: ReadAlongScript;
  seed: string;
  /** Art key per page. */
  arts: string[];
  /** Playback position in seconds, for timing-driven highlighting. */
  currentTime?: number;
  /** Explicit word index, used when the device reader reports boundaries. */
  activeWord?: number;
  page: number;
  onPageChange: (page: number) => void;
  /** Called when a reader taps a word to jump the audio there. */
  onSeekToPage?: (seconds: number) => void;
  playing: boolean;
}) {
  const [manual, setManual] = useState(false);
  const manualTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const index = useMemo(() => {
    if (typeof activeWord === 'number') return activeWord;
    if (typeof currentTime === 'number') return wordAt(script, currentTime);
    return -1;
  }, [activeWord, currentTime, script]);

  // Follow the voice, unless the reader has just turned a page themselves —
  // then leave them where they are for a few seconds.
  useEffect(() => {
    if (index < 0 || manual || !playing) return;
    const target = script.words[index]?.page;
    if (typeof target === 'number' && target !== page) onPageChange(target);
  }, [index, manual, playing, page, script.words, onPageChange]);

  const turnByHand = (next: number) => {
    setManual(true);
    clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => setManual(false), 6000);
    onPageChange(next);
    if (onSeekToPage) onSeekToPage(script.pageStarts[next] ?? 0);
  };

  useEffect(() => () => clearTimeout(manualTimer.current), []);

  const tokens = tokenisePage(script, page);
  const art = arts[page] ?? 'moon';

  return (
    <div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <StoryArt art={art} seed={seed} />

        <p
          lang="en"
          style={{
            padding: '22px 20px 24px',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            lineHeight: 1.75,
            margin: 0,
          }}
        >
          {tokens.map((token) => {
            const spoken = index >= 0 && token.index < index;
            const active = token.index === index;
            return (
              <span key={token.index}>
                <span
                  onClick={() => onSeekToPage?.(script.words[token.index]?.start ?? 0)}
                  style={{
                    // The active word is lifted with a warm highlight; words
                    // already read stay fully legible but step back a little,
                    // so a child can see how far along the line they are.
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-ink)' : spoken ? 'var(--ink)' : 'var(--ink-soft)',
                    borderRadius: 6,
                    padding: active ? '2px 4px' : '2px 0',
                    margin: active ? '0 -2px' : 0,
                    cursor: onSeekToPage ? 'pointer' : 'default',
                    transition: 'background 0.12s ease, color 0.12s ease',
                  }}
                >
                  {token.word}
                </span>
                {token.breakAfter ? <br /> : ' '}
              </span>
            );
          })}
        </p>
      </div>

      <div className="row" style={{ marginTop: 14, justifyContent: 'center', gap: 6 }}>
        {script.pages.map((_, i) => (
          <button
            key={i}
            onClick={() => turnByHand(i)}
            aria-label={`Page ${i + 1}`}
            aria-current={i === page ? 'true' : undefined}
            style={{
              width: i === page ? 24 : 8,
              height: 8,
              borderRadius: 999,
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              background: i === page ? 'var(--accent)' : 'var(--line)',
              transition: 'width 0.2s ease',
            }}
          />
        ))}
      </div>

      {manual && playing && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
          Following your page. It will catch up in a moment.
        </p>
      )}
    </div>
  );
}
