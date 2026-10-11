import type { Candidate, RouteResponse } from '../types';
import { prefLabel } from './format';

export type CandState = 'selected' | 'failed' | 'eligible' | 'rejected' | 'unavailable';

export const STATE_META: Record<CandState, { label: string; tone: 'mint' | 'coral' | 'cyan' | 'muted' | 'amber' }> = {
  selected: { label: 'Selected', tone: 'mint' },
  failed: { label: 'Attempted · failed', tone: 'coral' },
  eligible: { label: 'Eligible', tone: 'cyan' },
  rejected: { label: 'Rejected', tone: 'muted' },
  unavailable: { label: 'Unavailable', tone: 'amber' },
};

export function candState(c: Candidate, r: RouteResponse): CandState {
  if (c.model_id === r.chosen_model) return 'selected';
  if (r.failover_chain.some((f) => f.model_id === c.model_id)) return 'failed';
  if (!c.passed && c.circuit_state !== 'CLOSED') return 'unavailable';
  return c.passed ? 'eligible' : 'rejected';
}

/**
 * Display-only ordering of compliant candidates under the stated preference — the same
 * keys backend/app/engine/ranker.py sorts by. Note the backend ranks against the *remaining*
 * budget at each attempt; the candidate table it returns is evaluated against the original one.
 */
export function rankEligible(cands: Candidate[], pref: string): Candidate[] {
  const ok = cands.filter((c) => c.passed);
  if (pref === 'balanced_pareto' || pref === 'pareto') {
    // The returned table is re-evaluated after routing, so its `score` fields are 0.
    // Recompute ranker.py's weighted score over the compliant set for display.
    const sc = paretoScores(ok);
    return [...ok].sort((a, b) => sc.get(b.model_id)! - sc.get(a.model_id)!);
  }
  const key: Record<string, (a: Candidate, b: Candidate) => number> = {
    lowest_cost: (a, b) => a.predicted_cost_usd - b.predicted_cost_usd || a.predicted_latency_ms - b.predicted_latency_ms,
    lowest_latency: (a, b) => a.predicted_latency_ms - b.predicted_latency_ms || a.predicted_cost_usd - b.predicted_cost_usd,
    highest_capability: (a, b) => b.capability_score - a.capability_score || a.predicted_cost_usd - b.predicted_cost_usd,
  };
  return [...ok].sort(key[pref] ?? key.lowest_cost);
}

export function explain(r: RouteResponse, pref: string): string {
  const passed = r.candidates.filter((c) => c.passed).length;
  const e = r.estimator;
  const est = `Laya System 1 classified the prompt as ${e.raw_tier} (confidence ${e.confidence.toFixed(2)})`;
  const h = hedgeText(e);
  const hedge = h ? `; ${h}` : '';
  const capReq = `, so the minimum capability was set to ${e.required_capability.toFixed(2)}`;
  if (r.no_valid_model) {
    return `${est}${hedge}${capReq}. ${passed === 0 ? 'No model passed every hard constraint' : 'Every compliant model failed or exhausted the remaining budget'}, so RouteIQ refused instead of loosening a constraint.${r.closest_miss_suggestion ? ` Closest miss: ${r.closest_miss_suggestion}.` : ''}`;
  }
  const fo = r.failover_chain.length
    ? ` ${r.failover_chain.length} attempt${r.failover_chain.length > 1 ? 's' : ''} failed first. Each fallback was checked again against the remaining budget before it ran.`
    : '';
  return `${est}${hedge}${capReq}. ${passed} of ${r.candidates.length} models passed the hard constraints, and they were ranked by ${prefLabel(pref).toLowerCase()}.${fo} The request ran on ${r.chosen_model}.`;
}

/** Splits a route badge like "[SIMULATED]" into a tone for display. */
export function badgeTone(badge: string): 'mint' | 'violet' | 'amber' | 'coral' | 'muted' {
  if (/LIVE API/.test(badge)) return 'violet';
  if (/LOCAL GGUF: Metal/.test(badge)) return 'mint';
  if (/SIMULATED|INJECTED|Apple Silicon/.test(badge)) return 'amber';
  if (/RULE_ENFORCED/.test(badge)) return 'coral';
  return 'muted';
}

export function paretoScores(cands: Candidate[]): Map<string, number> {
  const range = (xs: number[]) => {
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return [lo, hi > lo ? hi - lo : 1] as const;
  };
  const [c0, cr] = range(cands.map((c) => c.predicted_cost_usd));
  const [l0, lr] = range(cands.map((c) => c.predicted_latency_ms));
  const [k0, kr] = range(cands.map((c) => c.capability_score));
  return new Map(
    cands.map((c) => [
      c.model_id,
      0.4 * (1 - (c.predicted_cost_usd - c0) / cr) + 0.3 * (1 - (c.predicted_latency_ms - l0) / lr) + 0.3 * ((c.capability_score - k0) / kr),
    ]),
  );
}

/** "raised to X" only when the hedge actually changed the tier. */
export function hedgeText(e: { elevated: boolean; raw_tier: string; tier: string; elevation_reason: string | null }) {
  if (!e.elevated) return null;
  const why = e.elevation_reason?.toLowerCase() ?? 'uncertainty';
  return e.raw_tier === e.tier ? `the uncertainty hedge fired (${why}) but ${e.tier} is already the top tier` : `raised to ${e.tier} because of ${why}`;
}
