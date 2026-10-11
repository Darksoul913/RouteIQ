import type { AuditResponse, BenchmarkResult, ChainStatus, Health, KeyStatus, Model, RouteRequest, RouteResponse } from './types';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const b = body as { error?: string; detail?: unknown } | null;
    const msg = b?.error ?? (typeof b?.detail === 'string' ? b.detail : null) ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  health: () => call<Health>('/health'),
  models: () => call<Model[]>('/models'),
  audit: () => call<AuditResponse>('/audit'),
  verify: () => call<ChainStatus>('/audit/verify'),
  keys: () => call<KeyStatus>('/keys'),
  saveKeys: (keys: Record<string, string>) => call<{ keys: KeyStatus }>('/keys', post(keys)),
  route: (req: RouteRequest) => call<RouteResponse>('/route', post(req)),
  benchmark: (count: number) => call<BenchmarkResult>('/benchmark/compare', post({ count })),
};
