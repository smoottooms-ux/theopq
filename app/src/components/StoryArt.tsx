import { useMemo } from 'react';
import { seeded } from '../lib/ids';

/**
 * Page illustrations, drawn as SVG.
 *
 * Every story page carries an `art` key; the same key plus the same story id
 * always produces the same picture, so a child re-reading a story sees the
 * book they remember. Nothing is fetched and nothing is generated remotely —
 * the art ships in the bundle and works on a plane at 3am.
 */

interface Props {
  art: string;
  seed: string;
  className?: string;
}

/** Palette families, chosen by the mood the art key implies. */
const MOODS: Record<string, [string, string, string]> = {
  night: ['#1b1740', '#3a2f63', '#8d7bd6'],
  dusk: ['#3b2450', '#7a3f63', '#e69a6b'],
  deep: ['#0d2b41', '#14506b', '#3fa2b8'],
  warm: ['#4a2340', '#a04a51', '#f0a86a'],
  bright: ['#1f3b63', '#3f6ea8', '#9fd2e8'],
};

const MOOD_FOR: Record<string, keyof typeof MOODS> = {
  moon: 'night', night: 'night', dusk: 'dusk', lamp: 'dusk', home: 'dusk',
  soft: 'night', thought: 'night', letter: 'night', note: 'night',
  shore: 'deep', dive: 'deep', dark: 'deep', free: 'deep', whales: 'deep', boat: 'deep',
  rocket: 'bright', launch: 'bright', alarm: 'deep', repair: 'deep', planet: 'warm', earth: 'bright',
  door: 'dusk', path: 'dusk', cliff: 'night', bridge: 'dusk', summit: 'warm',
  meadow: 'bright', rain: 'deep', listen: 'dusk', feast: 'warm',
  egg: 'warm', valley: 'bright', storm: 'night', crossing: 'dusk', hatch: 'warm',
  town: 'dusk', walk: 'dusk', doubt: 'night', share: 'warm', together: 'warm',
  stage: 'warm', freeze: 'night', step: 'dusk', cheer: 'warm', friend: 'dusk',
};

export function StoryArt({ art, seed, className }: Props) {
  const scene = useMemo(() => buildScene(art, seed), [art, seed]);
  return (
    <svg
      viewBox="0 0 400 240"
      className={className}
      role="img"
      aria-label={`Illustration: ${art}`}
      style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'inherit' }}
    >
      {scene}
    </svg>
  );
}

function buildScene(art: string, seed: string) {
  const rand = seeded(`${seed}:${art}`);
  const mood = MOODS[MOOD_FOR[art] ?? 'night'];
  const gid = `g-${Math.floor(rand() * 1e9).toString(36)}`;

  const stars = Array.from({ length: 34 }, (_, i) => {
    const x = rand() * 400;
    const y = rand() * 150;
    const r = 0.5 + rand() * 1.4;
    return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.25 + rand() * 0.6} />;
  });

  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mood[0]} />
          <stop offset="60%" stopColor={mood[1]} />
          <stop offset="100%" stopColor={mood[2]} />
        </linearGradient>
      </defs>

      <rect width="400" height="240" fill={`url(#${gid})`} />
      {stars}
      {celestial(art, rand)}
      {foreground(art, rand, mood)}
    </>
  );
}

function celestial(art: string, rand: () => number) {
  if (art === 'earth') {
    return (
      <g>
        <circle cx="300" cy="80" r="52" fill="#2f6fb5" />
        <path d="M262 62q22 10 40 2t34 6-18 26-40 4-30-16Z" fill="#4e9d68" opacity="0.85" />
        <circle cx="300" cy="80" r="52" fill="none" stroke="#bfe6ff" strokeWidth="2" opacity="0.5" />
      </g>
    );
  }
  if (art === 'planet') {
    return (
      <g>
        <circle cx="300" cy="74" r="44" fill="#c96a4a" />
        <ellipse cx="300" cy="74" rx="76" ry="14" fill="none" stroke="#f0c9a0" strokeWidth="4" opacity="0.7" />
        <circle cx="286" cy="62" r="8" fill="#a8523a" opacity="0.7" />
      </g>
    );
  }
  const cx = 60 + rand() * 60;
  return (
    <g>
      <circle cx={cx} cy="54" r="26" fill="#fdf3d6" opacity="0.95" />
      <circle cx={cx - 9} cy="48" r="5" fill="#e8dcbb" opacity="0.6" />
      <circle cx={cx + 7} cy="62" r="3.5" fill="#e8dcbb" opacity="0.6" />
    </g>
  );
}

function foreground(art: string, rand: () => number, mood: [string, string, string]) {
  const dark = '#140f26';

  const hills = (
    <g fill={dark} opacity="0.85">
      <path d="M0 240V180q60-34 120-6t130-20 150-14v100Z" />
    </g>
  );

  const trees = Array.from({ length: 7 }, (_, i) => {
    const x = 20 + i * 58 + rand() * 18;
    const h = 30 + rand() * 34;
    return (
      <path
        key={i}
        d={`M${x} 200 l${-9} 0 l9 -${h} l9 ${h} Z`}
        fill={dark}
        opacity="0.9"
      />
    );
  });

  const water = (
    <g>
      <rect y="150" width="400" height="90" fill={mood[2]} opacity="0.35" />
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d={`M${rand() * 340} ${162 + i * 9} q14 -5 28 0`}
          stroke="#fff"
          strokeWidth="1.5"
          fill="none"
          opacity="0.28"
        />
      ))}
    </g>
  );

  const houses = (
    <g fill={dark}>
      <path d="M40 240v-52l30-24 30 24v52Z" />
      <path d="M140 240v-40l26-20 26 20v40Z" />
      <path d="M250 240v-60l34-26 34 26v60Z" />
      <rect x="58" y="196" width="14" height="14" fill="#ffd98a" />
      <rect x="276" y="192" width="16" height="18" fill="#ffd98a" />
    </g>
  );

  switch (art) {
    case 'shore':
    case 'boat':
    case 'dive':
    case 'whales':
    case 'free':
      return (
        <g>
          {water}
          {art === 'boat' && (
            <path d="M160 168h80l-12 18h-56Z M198 168v-34l30 20-30 6" fill={dark} />
          )}
          {art === 'whales' && (
            <path d="M120 200q40-40 96-30t100 34q-60 16-110 8t-86-12Z" fill={dark} opacity="0.85" />
          )}
        </g>
      );

    case 'dark':
      return (
        <g>
          <rect y="120" width="400" height="120" fill="#04121e" opacity="0.9" />
          <circle cx="210" cy="180" r="26" fill="#7fe3d2" opacity="0.25" />
          <circle cx="210" cy="180" r="8" fill="#bffaf0" opacity="0.8" />
        </g>
      );

    case 'rocket':
    case 'launch':
      return (
        <g>
          {hills}
          <path d="M196 200v-56q0-26 12-42 12 16 12 42v56Z" fill="#e8e4f2" />
          <path d="M196 176l-16 26h16Zm24 0l16 26h-16Z" fill="#c8536a" />
          <circle cx="208" cy="148" r="7" fill="#7fc7e8" />
          {art === 'launch' && (
            <path d="M200 202q8 26 16 0 6 22 0 30-10 8-20 0-6-10 4-30Z" fill="#ffb066" opacity="0.9" />
          )}
        </g>
      );

    case 'meadow':
    case 'valley':
    case 'listen':
      return (
        <g>
          {hills}
          {Array.from({ length: 24 }, (_, i) => (
            <path
              key={i}
              d={`M${rand() * 400} 240 q3 -${12 + rand() * 16} 8 -${16 + rand() * 12}`}
              stroke={dark}
              strokeWidth="2"
              fill="none"
              opacity="0.7"
            />
          ))}
        </g>
      );

    case 'town':
    case 'walk':
    case 'home':
    case 'lamp':
    case 'share':
    case 'together':
      return (
        <g>
          {hills}
          {houses}
        </g>
      );

    case 'door':
      return (
        <g>
          {hills}
          <path d="M170 240v-46a30 30 0 0 1 60 0v46Z" fill="#2a1e40" />
          <path d="M178 240v-42a22 22 0 0 1 44 0v42Z" fill="#ffd98a" opacity="0.9" />
          <circle cx="214" cy="212" r="3.5" fill="#2a1e40" />
        </g>
      );

    case 'bridge':
    case 'crossing':
      return (
        <g>
          {water}
          <path d="M0 176h400" stroke={dark} strokeWidth="6" />
          <path d="M40 176v40M120 176v46M200 176v50M280 176v46M360 176v40" stroke={dark} strokeWidth="5" />
          <path d="M0 176q100-46 200-46t200 46" stroke={dark} strokeWidth="5" fill="none" />
        </g>
      );

    case 'cliff':
    case 'summit':
    case 'storm':
    case 'freeze':
      return (
        <g fill={dark}>
          <path d="M0 240V150l90-70 70 92 60-42 80 60 100-40v90Z" />
          {art === 'storm' && (
            <path d="M210 60l-22 42h20l-14 38 40-52h-20Z" fill="#ffd98a" opacity="0.9" />
          )}
        </g>
      );

    case 'rain':
      return (
        <g>
          {hills}
          {Array.from({ length: 40 }, (_, i) => {
            const x = rand() * 400;
            const y = rand() * 200;
            return <path key={i} d={`M${x} ${y}l-3 12`} stroke="#bcd9f0" strokeWidth="1.6" opacity="0.5" />;
          })}
        </g>
      );

    case 'egg':
    case 'hatch':
      return (
        <g>
          {hills}
          <ellipse cx="200" cy="196" rx="38" ry="46" fill="#f2e6cf" />
          {art === 'hatch' && (
            <path d="M162 190l16 10 14-14 16 12 14-10 16 8" stroke="#c9b48c" strokeWidth="3" fill="none" />
          )}
          <ellipse cx="186" cy="182" rx="8" ry="10" fill="#dcc9a5" opacity="0.6" />
        </g>
      );

    case 'stage':
    case 'cheer':
      return (
        <g>
          <rect y="180" width="400" height="60" fill={dark} />
          <path d="M200 180v-40" stroke={dark} strokeWidth="4" />
          <circle cx="200" cy="128" r="16" fill="#ffd98a" />
          <path d="M60 180q140-70 280 0" stroke="#ffd98a" strokeWidth="2" fill="none" opacity="0.4" />
        </g>
      );

    case 'note':
    case 'letter':
      return (
        <g>
          {hills}
          <g transform="translate(140 130) rotate(-4)">
            <rect width="120" height="86" rx="6" fill="#fdf6e8" />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x="14" y={20 + i * 16} width={i === 3 ? 56 : 92} height="5" rx="2.5" fill="#c9bda6" />
            ))}
          </g>
        </g>
      );

    case 'soft':
    case 'thought':
    case 'dusk':
    case 'night':
    case 'moon':
    default:
      return (
        <g>
          {hills}
          {trees}
        </g>
      );
  }
}
