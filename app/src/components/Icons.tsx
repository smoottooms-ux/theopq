/** Inline stroke icons. 24px grid, currentColor, no icon library dependency. */

type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconMoon = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

export const IconMic = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);

export const IconBook = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4.5h6a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h6v13h-6a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H4Z" />
    <path d="M12 5.5v13" />
  </svg>
);

export const IconGame = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="7" width="19" height="10" rx="4" />
    <path d="M7 10.5v3M5.5 12h3M15.5 11h.01M18 13.5h.01" />
  </svg>
);

export const IconHome = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.5v10h13v-10" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
);

export const IconUsers = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M16 5.6a3.2 3.2 0 0 1 0 6.3M17.5 14.4c2.1.6 3.5 2.4 3.5 4.6" />
  </svg>
);

export const IconChart = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 20v-6M12.5 20V8M17 20v-9" />
  </svg>
);

export const IconGear = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.04A1.7 1.7 0 0 0 21 10.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03Z" />
  </svg>
);

export const IconPlay = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <path d="M8 5.2a1 1 0 0 1 1.54-.84l9 6.8a1 1 0 0 1 0 1.68l-9 6.8A1 1 0 0 1 8 18.8Z" />
  </svg>
);

export const IconPause = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className} fill="currentColor" stroke="none">
    <rect x="6.5" y="5" width="4" height="14" rx="1.4" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.4" />
  </svg>
);

export const IconBack = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconPlus = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.4}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
);

export const IconX = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconSend = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20.5 3.5 10.5 13.5M20.5 3.5l-6.4 17-3.6-7-7-3.6Z" />
  </svg>
);

export const IconSpark = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9Z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
  </svg>
);

export const IconTrash = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5 7.5 20h9l1-13.5M10.5 10v6M13.5 10v6" />
  </svg>
);

export const IconLock = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconRefresh = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </svg>
);

export const IconMusic = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 18V5.5l11-2V16" />
    <circle cx="6.5" cy="18" r="2.6" />
    <circle cx="17.5" cy="16" r="2.6" />
  </svg>
);

export const IconArchive = ({ size = 24, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="4.5" rx="1.6" />
    <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" />
    <path d="M10 12.5h4" />
  </svg>
);
