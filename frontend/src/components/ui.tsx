import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/format';

const PATHS: Record<string, string> = {
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  route: 'M6 3v6a6 6 0 0 0 6 6h6M18 15l-3-3M18 15l-3 3M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 7a2 2 0 1 0 0-4',
  fleet: 'M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01',
  traces: 'M3 12h4l3-8 4 16 3-8h4',
  policy: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  lab: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 14h9',
  audit: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  key: 'M14 10a4 4 0 1 0-3.9 4H11v3h3v3h3v-3.5L14.5 14A4 4 0 0 0 14 10zM15.5 8.5h.01',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M9 6l6 6-6 6',
  collapse: 'M15 6l-6 6 6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  play: 'M7 5l12 7-12 7z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
};

export function Icon({ name, size = 16, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="lg-riq" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B8BA0" />
          <stop offset="1" stopColor="#6246D8" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="5.2" fill="url(#lg-riq)" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="url(#lg-riq)" strokeOpacity=".55" strokeWidth="1.2" strokeDasharray="2 3.2" />
      {[[16, 3.5], [27, 20], [6, 23.5]].map(([x, y], i) => (
        <g key={i}>
          <line x1="16" y1="16" x2={x} y2={y} stroke="url(#lg-riq)" strokeOpacity=".6" strokeWidth="1" />
          <circle cx={x} cy={y} r="2.1" fill="#fff" stroke="#0B8BA0" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}

export type Tone = 'cyan' | 'violet' | 'mint' | 'amber' | 'coral' | 'muted';

export function Badge({ tone = 'muted', children, dot, title }: { tone?: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span className={cx('badge', `tone-${tone}`)} title={title}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/** Number that eases to its new value instead of jumping (no count-up from zero on mount). */
export function Num({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      from.current = value;
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 600);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return <>{format(shown)}</>;
}

export function Metric({ label, value, sub, tone, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; children?: ReactNode }) {
  return (
    <div className={cx('metric', tone && `metric-${tone}`)}>
      <div className="metric-label">{label}</div>
      <div className="metric-value mono">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Sparkline({ values, tone = 'cyan', height = 28 }: { values: number[]; tone?: Tone; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${height - 2 - ((v - min) / span) * (height - 4)}`).join(' ');
  return (
    <svg className={cx('spark', `tone-${tone}`)} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" height={height} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Panel({ title, actions, children, className, sub }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('panel', className)}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {title && <h3 className="panel-title">{title}</h3>}
            {sub && <p className="panel-sub">{sub}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, children, icon = 'traces' }: { title: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={20} />
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function KV({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <b className={mono ? 'mono' : undefined}>{v}</b>
    </div>
  );
}

export function Check({ ok, label }: { ok: boolean; label: ReactNode }) {
  return (
    <span className={cx('check', ok ? 't-mint' : 't-coral')}>
      <Icon name={ok ? 'check' : 'x'} size={12} />
      {label}
    </span>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <div className={cx('drawer-wrap', open && 'open')} aria-hidden={!open}>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'}>
        <header className="drawer-head">
          <div className="drawer-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div className="drawer-body">{open && children}</div>
      </aside>
    </div>
  );
}
