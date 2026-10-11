import { Badge, Panel } from '../components/ui';
import { PREFERENCES } from '../lib/format';

// The backend has no policy API. These values mirror backend/app/config.py and the engine
// source at the time of writing; they are shown read-only and must be edited in code.
const GROUPS: { title: string; kind: 'hard' | 'pref' | 'mixed'; source: string; rows: [string, string, string?][] }[] = [
  {
    title: 'Hard constraints',
    kind: 'hard',
    source: 'engine/constraints.py · per request',
    rows: [
      ['max_latency_ms', 'predicted p95 (or base) + injected latency ≤ remaining budget'],
      ['max_cost_usd', 'tokens_in/1k × in-rate + tokens_out/1k × out-rate ≤ remaining budget'],
      ['min_capability', 'capability_score ≥ max(user minimum, tier minimum)'],
      ['required_context', 'context_window ≥ max(prompt + output tokens, required_context)'],
    ],
  },
  {
    title: 'Complexity classification',
    kind: 'hard',
    source: 'estimators/multi_estimator.py · config.py',
    rows: [
      ['tier → min capability', 'easy 0.30 · medium 0.65 · hard 0.80', 'TIER_CAPABILITY_MAP'],
      ['confidence threshold', '0.70: below this, the tier is raised one level', 'ESTIMATOR_CONFIDENCE_THRESHOLD'],
      ['disagreement hedge', 'tier raised when the primary estimator and the heuristic disagree'],
      ['estimator order', 'TF-IDF primary → Laya System 1 fallback → regex heuristic cross-check'],
    ],
  },
  {
    title: 'Endpoint health & circuit breakers',
    kind: 'hard',
    source: 'engine/circuit_breaker.py · config.py',
    rows: [
      ['failure threshold', '3 consecutive failures → OPEN', 'CIRCUIT_BREAKER_FAILURE_THRESHOLD'],
      ['cooldown', '15 s, then HALF_OPEN admits probe requests; one success closes it', 'CIRCUIT_BREAKER_COOLDOWN_SECONDS'],
      ['latency telemetry', 'rolling p95 of the last 50 calls, EMA α = 0.2'],
    ],
  },
  {
    title: 'Fallback selection, retry & timeout',
    kind: 'hard',
    source: 'engine/executor.py',
    rows: [
      ['shrinking budget', 'L_rem = L_orig − t_estimation − Σ t_failed_attempts'],
      ['revalidation', 'every fallback re-runs all hard constraints against the remaining budget'],
      ['retry policy', 'each model is tried at most once per request'],
      ['per-attempt timeout', 'the remaining latency budget'],
      ['stop condition', 'remaining latency ≤ 20 ms, or no compliant candidates left → structured refusal'],
    ],
  },
  {
    title: 'Optimization objectives',
    kind: 'pref',
    source: 'engine/ranker.py · per request',
    rows: PREFERENCES.map((p) => [
      p.value,
      {
        lowest_cost: 'sort by predicted cost, then latency',
        lowest_latency: 'sort by predicted latency, then cost',
        highest_capability: 'sort by capability (descending), then cost',
        balanced_pareto: 'score = 0.4·(1−cost) + 0.3·(1−latency) + 0.3·capability (min-max normalised)',
      }[p.value],
    ]),
  },
  {
    title: 'Independent auditor tolerances',
    kind: 'mixed',
    source: 'engine/auditor.py · config.py',
    rows: [
      ['latency', 'violation if actual > max + 5 ms', 'AUDITOR_LATENCY_TOLERANCE_MS'],
      ['cost', 'violation if actual > max × 1.01', 'AUDITOR_COST_TOLERANCE_RATIO'],
      ['capability / context', 'exact comparison against the request'],
    ],
  },
];

export default function Policies() {
  return (
    <div className="policies">
      <div className="callout tone-violet">
        <b>Read-only.</b> RouteIQ has no API for changing policy. This page describes the rules the engine enforces right now, taken from its source code. Per-request limits and preferences are set in <a href="#/app/live">Live Routing</a>. Everything else is changed in <code>backend/app/config.py</code>.
      </div>
      <div className="legend-row small">
        <Badge tone="coral">enforced</Badge> a constraint the engine never relaxes
        <Badge tone="cyan">preference</Badge> only changes the order of models that already comply
      </div>
      <div className="policy-grid">
        {GROUPS.map((g) => (
          <Panel key={g.title} title={g.title} sub={<span className="mono">{g.source}</span>} actions={<Badge tone={g.kind === 'pref' ? 'cyan' : g.kind === 'hard' ? 'coral' : 'amber'}>{g.kind === 'pref' ? 'preference' : g.kind === 'hard' ? 'enforced' : 'verification'}</Badge>}>
            <dl className="policy-rows">
              {g.rows.map(([k, v, cfg]) => (
                <div key={k}>
                  <dt className="mono">{k}</dt>
                  <dd>
                    {v}
                    {cfg && <span className="mono t-dim small"> · {cfg}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>
    </div>
  );
}
