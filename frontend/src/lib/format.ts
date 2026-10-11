import type { AuditRecord, Model, RouteResponse } from '../types';

export const usd = (n: number | undefined | null, digits = 6) => `$${(n ?? 0).toFixed(digits)}`;
export const ms = (n: number | undefined | null) => `${Math.round(n ?? 0).toLocaleString()} ms`;
export const int = (n: number | undefined | null) => Math.round(n ?? 0).toLocaleString();
export const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
export const ctx = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`);
export const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const shortHash = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : '—');

export const isLocal = (m: Pick<Model, 'endpoint_type'>) => m.endpoint_type === 'local_gguf';

export const PREFERENCES = [
  { value: 'lowest_cost', label: 'Lowest cost' },
  { value: 'lowest_latency', label: 'Lowest latency' },
  { value: 'highest_capability', label: 'Highest capability' },
  { value: 'balanced_pareto', label: 'Balanced (Pareto)' },
] as const;

export const prefLabel = (p: string) => PREFERENCES.find((x) => x.value === p)?.label ?? p;

/** p-th percentile, same index rule as backend telemetry (floor(n*p), clamped). */
export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

export function parseRecord(r: AuditRecord): RouteResponse | null {
  try {
    return JSON.parse(r.response_json) as RouteResponse;
  } catch {
    return null;
  }
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
