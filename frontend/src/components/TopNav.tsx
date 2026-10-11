import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Icon, Logo } from './ui';
import { useStore } from '../store';
import { cx } from '../lib/format';

export const PRIMARY = [
  { id: 'overview', label: 'Overview', href: '#/' },
  { id: 'live', label: 'Live routing', href: '#/app/live' },
  { id: 'fleet', label: 'Model fleet', href: '#/app/fleet' },
  { id: 'traces', label: 'Traces', href: '#/app/traces' },
  { id: 'audit', label: 'Audit', href: '#/app/audit' },
];
export const SECONDARY = [
  { id: 'policies', label: 'Routing policies', href: '#/app/policies' },
  { id: 'lab', label: 'Evaluation lab', href: '#/app/lab' },
  { id: 'keys', label: 'API keys', href: '#/app/keys' },
  { id: 'settings', label: 'Settings', href: '#/app/settings' },
];

export function HealthPill() {
  const { online, health } = useStore();
  if (online === null) return <Badge tone="muted" dot>connecting</Badge>;
  if (!online) return <Badge tone="coral" dot>gateway offline</Badge>;
  const bad = (health?.auditor_violations ?? 0) > 0 || health?.chain_valid === false;
  return (
    <Badge tone={bad ? 'amber' : 'mint'} dot title={health ? `${health.total_audited_requests} audited requests · chain ${health.chain_valid ? 'valid' : 'BROKEN'}` : undefined}>
      {bad ? 'attention' : 'online'}
      {health ? ` · ${health.models_registered} models` : ''}
    </Badge>
  );
}

/** Shared floating navigation for the home page and every workspace page. */
export default function TopNav({ active }: { active: string }) {
  const { profile, keys, health } = useStore();
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const keyCount = Object.values(keys).filter(Boolean).length;
  const secondaryActive = SECONDARY.some((s) => s.id === active);

  useEffect(() => setMore(false), [active]);
  useEffect(() => {
    if (!more) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !moreRef.current?.contains(e.target as Node)) setMore(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [more]);

  const badge = (id: string) =>
    id === 'keys' && keyCount > 0 ? <em className="mono">{keyCount}</em> : id === 'audit' && (health?.auditor_violations ?? 0) > 0 ? <em className="mono t-coral">{health!.auditor_violations}</em> : null;

  return (
    <nav className="l-nav top-nav" aria-label="Main">
      <a className="brand" href="#/" aria-label="RouteIQ overview">
        <Logo />
        <span className="brand-name">RouteIQ</span>
        <span className="brand-ver mono">VORTEXA 3.0</span>
      </a>
      <div className="tabs">
        {PRIMARY.map((t) => (
          <a key={t.id} href={t.href} className={cx('tab', t.id === active && 'on')} aria-current={t.id === active ? 'page' : undefined}>
            {t.label}
            {badge(t.id)}
          </a>
        ))}
        {SECONDARY.map((t) => (
          <a key={t.id} href={t.href} className={cx('tab tab-secondary', t.id === active && 'on')} aria-current={t.id === active ? 'page' : undefined}>
            {t.label}
            {badge(t.id)}
          </a>
        ))}
        <div className="more" ref={moreRef}>
          <button className={cx('tab', secondaryActive && 'on')} aria-expanded={more} aria-haspopup="menu" onClick={() => setMore((m) => !m)}>
            {secondaryActive ? SECONDARY.find((s) => s.id === active)!.label : 'More'}
            <Icon name="chevron" size={13} className={cx('more-chev', more && 'open')} />
          </button>
          {more && (
            <div className="more-menu" role="menu">
              {SECONDARY.map((t) => (
                <a key={t.id} role="menuitem" href={t.href} className={cx(t.id === active && 'on')}>
                  {t.label}
                  {badge(t.id)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="nav-right">
        <span className="hide-md"><HealthPill /></span>
        <a href="#/app/settings" className="avatar mono" title={`${profile.name} · settings`}>{profile.avatar.slice(0, 3)}</a>
      </div>
    </nav>
  );
}

/** Static flowing lines echoing the home terrain, for page header bands. */
export function WaveLines({ rows = 18, className }: { rows?: number; className?: string }) {
  const paths = useMemo(
    () =>
      Array.from({ length: rows }, (_, j) => {
        const d = j / (rows - 1);
        const amp = 10 + d * 22;
        let p = '';
        for (let i = 0; i <= 60; i++) {
          const x = (i / 60) * 1200;
          const y = 20 + d * 120 + amp * Math.sin(x / 170 + j * 0.45) + 6 * Math.sin(x / 61 - j * 0.9);
          p += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
        }
        return { p, d };
      }),
    [rows],
  );
  return (
    <svg className={cx('wave-lines', className)} viewBox="0 0 1200 170" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="wl-g" x1="0" x2="1">
          <stop offset="0" stopColor="#6246d8" />
          <stop offset="1" stopColor="#0b8ba0" />
        </linearGradient>
      </defs>
      {paths.map(({ p, d }, i) => (
        <path key={i} d={p} fill="none" stroke="url(#wl-g)" strokeOpacity={0.08 + d * 0.22} strokeWidth={0.6 + d * 0.6} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
