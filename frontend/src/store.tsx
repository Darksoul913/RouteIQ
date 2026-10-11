import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { AuditResponse, Health, KeyStatus, Model, RouteRequest, RouteResponse } from './types';

/* ---------- route event bus: lets canvases animate real routing results ---------- */
export interface RouteEvent {
  result: RouteResponse;
}
type Listener = (e: RouteEvent) => void;
const listeners = new Set<Listener>();
export const routeBus = {
  emit: (e: RouteEvent) => listeners.forEach((l) => l(e)),
  on: (l: Listener) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

/* ---------- session metrics (browser-local, same semantics as the previous dashboard) ---------- */
export interface Session {
  startedAt: string | null;
  queries: number;
  refusals: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  baselineCost: number;
  baselineName: string | null;
}
const emptySession = (): Session => ({
  startedAt: null, queries: 0, refusals: 0, tokensIn: 0, tokensOut: 0, cost: 0, baselineCost: 0, baselineName: null,
});

export interface Run {
  req: RouteRequest;
  res: RouteResponse;
}

export interface Profile {
  name: string;
  role: string;
  avatar: string;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

interface Store {
  models: Model[];
  health: Health | null;
  audit: AuditResponse | null;
  keys: KeyStatus;
  online: boolean | null; // null = unknown yet
  session: Session;
  resetSession: () => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  history: Run[];
  inFlight: boolean;
  runRoute: (req: RouteRequest) => Promise<RouteResponse>;
  refreshAudit: () => Promise<void>;
  refreshKeys: () => Promise<void>;
  setKeys: (k: KeyStatus) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<Model[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [keys, setKeys] = useState<KeyStatus>({});
  const [online, setOnline] = useState<boolean | null>(null);
  const [session, setSession] = useState<Session>(() => load('routeiq_session_v3', emptySession()));
  const [profile, setProfileState] = useState<Profile>(() =>
    load('routeiq_user_profile', { name: 'Alex Vance', role: 'Principal AI Architect', avatar: 'AV' }),
  );
  const [history, setHistory] = useState<Run[]>([]);
  const [inFlight, setInFlight] = useState(false);
  const inFlightRef = useRef(false);

  const refreshModels = useCallback(async () => {
    try {
      setModels(await api.models());
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);
  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await api.health());
    } catch {
      setHealth(null);
    }
  }, []);
  const refreshAudit = useCallback(async () => {
    try {
      setAudit(await api.audit());
    } catch {
      /* keep last good snapshot */
    }
  }, []);
  const refreshKeys = useCallback(async () => {
    try {
      setKeys(await api.keys());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshModels();
    refreshHealth();
    refreshAudit();
    refreshKeys();
    // Poll only while the tab is visible.
    const tick = (fn: () => void) => () => !document.hidden && fn();
    const ids = [
      setInterval(tick(refreshModels), 4000),
      setInterval(tick(refreshHealth), 10000),
      setInterval(tick(refreshAudit), 8000),
    ];
    return () => ids.forEach(clearInterval);
  }, [refreshModels, refreshHealth, refreshAudit, refreshKeys]);

  useEffect(() => save('routeiq_session_v3', session), [session]);

  const runRoute = useCallback(
    async (req: RouteRequest) => {
      if (inFlightRef.current) throw new Error('A request is already in flight');
      inFlightRef.current = true;
      setInFlight(true);
      try {
        const result = await api.route(req);
        const a = result.actual_metrics;
        const refused = result.no_valid_model;
        setSession((s) => ({
          startedAt: s.startedAt ?? new Date().toISOString(),
          queries: s.queries + 1,
          refusals: s.refusals + (refused ? 1 : 0),
          tokensIn: s.tokensIn + (a.tokens_in ?? 0),
          tokensOut: s.tokensOut + (a.tokens_out ?? 0),
          cost: s.cost + (a.total_cost_usd ?? 0),
          baselineCost: s.baselineCost + (refused ? 0 : result.cost_matrix?.baseline_cost_usd ?? 0),
          baselineName: result.cost_matrix?.baseline_model_name ?? s.baselineName,
        }));
        setHistory((h) => [{ req, res: result }, ...h].slice(0, 30));
        routeBus.emit({ result });
        refreshModels();
        refreshAudit();
        refreshHealth();
        return result;
      } finally {
        inFlightRef.current = false;
        setInFlight(false);
      }
    },
    [refreshModels, refreshAudit, refreshHealth],
  );

  const value = useMemo<Store>(
    () => ({
      models, health, audit, keys, online, session, history, inFlight, profile,
      resetSession: () => setSession(emptySession()),
      setProfile: (p) => {
        setProfileState(p);
        save('routeiq_user_profile', p);
      },
      runRoute, refreshAudit, refreshKeys, setKeys,
    }),
    [models, health, audit, keys, online, session, history, inFlight, profile, runRoute, refreshAudit, refreshKeys],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/* ---------- hash router ---------- */
export function useHashRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || '';
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (path: string) => {
  window.location.hash = `/${path}`;
};

export function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}
