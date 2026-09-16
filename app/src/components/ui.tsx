import { createPortal } from 'react-dom';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { IconBack, IconX } from './Icons';

/* ---------------- Top bar ---------------- */

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
      )}
      <div className="topbar__title">
        <h1>{title}</h1>
        {subtitle && <div className="topbar__sub">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------------- Sheet ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);

    // Freeze the page behind the sheet; otherwise scrolling inside the sheet
    // drags the screen underneath it on touch devices.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Portalled to <body>: `.screen` establishes its own stacking context, so a
  // sheet rendered in place would sit underneath the fixed tab bar no matter
  // what z-index it carries.
  if (!open) return null;

  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grip" />
        {title && (
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 style={{ flex: 1 }}>{title}</h2>
            <button className="iconbtn" onClick={onClose} aria-label="Close">
              <IconX />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Toast ---------------- */

const ToastCtx = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------------- Form helpers ---------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; emoji?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.emoji && <span aria-hidden>{o.emoji}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MultiChipGroup({
  options,
  value,
  onChange,
  max,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const toggle = (option: string) => {
    if (value.includes(option)) onChange(value.filter((v) => v !== option));
    else if (!max || value.length < max) onChange([...value, option]);
  };

  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className="chip"
          aria-pressed={value.includes(o)}
          onClick={() => toggle(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Misc ---------------- */

export function Empty({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__emoji" aria-hidden>
        {emoji}
      </div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      {body && <p className="muted" style={{ maxWidth: 320, margin: '0 auto 16px' }}>{body}</p>}
      {action}
    </div>
  );
}

export function Bar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      {label && (
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="soft" style={{ flex: 1 }}>{label}</span>
          <span className="muted">{pct}%</span>
        </div>
      )}
      <div className="bar">
        <div className="bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A numeric PIN entry that keeps mobile keyboards on the number pad. */
export function PinInput({
  value,
  onChange,
  length = 4,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      className="input"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      maxLength={length}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
      placeholder={'•'.repeat(length)}
      style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: 22 }}
      aria-label={`${length} digit code`}
    />
  );
}

/** Live microphone level bars. Purely decorative, driven by the recorder. */
export function LevelMeter({ level }: { level: number }) {
  const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  return (
    <div className="row" style={{ gap: 3, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
      {bars.map((i) => {
        const distance = Math.abs(i - 11.5) / 11.5;
        const height = Math.max(4, level * 44 * (1 - distance * 0.7));
        return (
          <div
            key={i}
            style={{
              width: 4,
              height,
              borderRadius: 2,
              background: 'var(--accent)',
              opacity: 0.4 + level * 0.6,
              transition: 'height 80ms linear',
            }}
          />
        );
      })}
    </div>
  );
}
