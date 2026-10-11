import { useEffect, useState } from 'react';
import type { Candidate, RouteResponse } from '../types';
import { useReducedMotion } from '../store';
import { candState, rankEligible, STATE_META } from '../lib/decision';
import { cx, ms, prefLabel, usd } from '../lib/format';

export interface Stage {
  label: string;
  detail: (r: RouteResponse, pref: string) => string;
  bad?: (r: RouteResponse) => boolean;
}

const passCount = (r: RouteResponse) => `${r.candidates.filter((c) => c.passed).length}/${r.candidates.length} pass`;

export const WORKSPACE_STAGES: Stage[] = [
  { label: 'Request', detail: (r) => `${r.actual_metrics.tokens_in ?? r.cost_matrix?.tokens_in ?? '—'} tok in` },
  { label: 'Complexity', detail: (r) => `${r.estimator.tier}${r.estimator.raw_tier !== r.estimator.tier ? ' ↑' : ''} · ${r.estimator.confidence.toFixed(2)}` },
  { label: 'Feasibility', detail: passCount, bad: (r) => r.candidates.every((c) => !c.passed) },
  { label: 'Ranking', detail: (_r, p) => prefLabel(p) },
  {
    label: 'Endpoint',
    detail: (r) => (r.chosen_model ? `${r.chosen_model}${r.failover_chain.length ? ` · ${r.failover_chain.length} failover` : ''}` : 'none feasible'),
    bad: (r) => r.no_valid_model,
  },
  {
    label: 'Response',
    detail: (r) => (r.no_valid_model ? 'refused' : `${ms(r.actual_metrics.total_latency_ms)} · ${usd(r.actual_metrics.total_cost_usd)}`),
    bad: (r) => r.no_valid_model,
  },
];

export const LANDING_STAGES: Stage[] = [
  { label: 'Incoming request', detail: (r) => `${r.cost_matrix?.tokens_in ?? '—'} tokens` },
  { label: 'Constraint analysis', detail: (r) => `tier ${r.estimator.tier} · cap ≥ ${r.estimator.required_capability.toFixed(2)}` },
  { label: 'Candidate evaluation', detail: passCount, bad: (r) => r.candidates.every((c) => !c.passed) },
  { label: 'Model selection', detail: (r) => r.chosen_model ?? 'none feasible', bad: (r) => r.no_valid_model },
  {
    label: 'Execution',
    detail: (r) => (r.no_valid_model ? 'structured refusal' : `${ms(r.actual_metrics.total_latency_ms)} · ${usd(r.actual_metrics.total_cost_usd)}`),
    bad: (r) => r.no_valid_model,
  },
];

const STEP_MS = 420;

interface Props {
  stages: Stage[];
  result: RouteResponse | null;
  pref: string;
  running: boolean;
  error?: string | null;
  onInspect?: (c: Candidate) => void;
  showCandidates?: boolean;
}

export default function Pipeline({ stages, result, pref, running, error, onInspect, showCandidates = true }: Props) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(result ? stages.length : 0);

  // Replay the real result stage by stage.
  useEffect(() => {
    if (!result) return setShown(0);
    if (reduced) return setShown(stages.length);
    setShown(1);
    let i = 1;
    const id = setInterval(() => {
      i++;
      setShown(i);
      if (i >= stages.length) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [result, reduced, stages.length]);

  const done = result && shown >= stages.length;
  const pos = running ? 0.5 : result ? Math.max(0, shown - 1) : 0;
  const frac = pos / (stages.length - 1);
  const ranked = result ? rankEligible(result.candidates, pref) : [];
  const cands = result
    ? [...result.candidates].sort((a, b) => order(candState(a, result)) - order(candState(b, result)) || ranked.indexOf(a) - ranked.indexOf(b))
    : [];

  return (
    <div className="pipeline">
      <div className="pipe-track" style={{ ['--n' as string]: stages.length }}>
        <div className="pipe-line" />
        <div className="pipe-line-fill" style={{ width: `calc(${frac} * (100% - 100% / ${stages.length}))` }} />
        {(running || result) && (
          <div
            className={cx('pipe-packet', running && 'waiting', result?.no_valid_model && done && 'refused')}
            style={{ left: `calc(${frac} * (100% - 100% / ${stages.length}))` }}
          />
        )}
        {stages.map((s, i) => {
          const reached = result && i < shown;
          const bad = reached && s.bad?.(result!);
          return (
            <div key={s.label} className={cx('pipe-stage', reached && 'reached', bad && 'bad', running && i === 0 && 'active')}>
              <div className="pipe-node">
                <span>{i + 1}</span>
              </div>
              <div className="pipe-label">{s.label}</div>
              <div className="pipe-detail mono">{reached ? s.detail(result!, pref) : running && i === 0 ? 'sending…' : '—'}</div>
            </div>
          );
        })}
      </div>

      {error && <div className="callout tone-coral">Gateway error: {error}</div>}

      {showCandidates && result && (
        <div className={cx('cand-grid', done && 'in')}>
          {cands.map((c, i) => {
            const st = candState(c, result);
            const rank = ranked.indexOf(c);
            return (
              <button
                key={c.model_id}
                className={cx('cand', `cand-${st}`)}
                style={{ transitionDelay: reduced ? '0ms' : `${i * 35}ms` }}
                onClick={() => onInspect?.(c)}
                aria-label={`${c.model_name}: ${STATE_META[st].label}. Inspect`}
              >
                <div className="cand-top">
                  <span className="cand-id mono">{c.model_id}</span>
                  <span className={cx('cand-state', `tone-${STATE_META[st].tone}`)}>
                    {st === 'eligible' && rank >= 0 ? `#${rank + 1} ` : ''}
                    {STATE_META[st].label}
                  </span>
                </div>
                <div className="cand-meta mono">
                  <span className={c.latency_fit ? '' : 't-coral'}>{ms(c.predicted_latency_ms)}</span>
                  <span className={c.cost_fit ? '' : 't-coral'}>{usd(c.predicted_cost_usd)}</span>
                  <span className={c.capability_fit ? '' : 't-coral'}>cap {c.capability_score.toFixed(2)}</span>
                </div>
                {!c.passed && <div className="cand-why">{c.rejection_reasons[0]}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const order = (s: string) => ['selected', 'failed', 'eligible', 'unavailable', 'rejected'].indexOf(s);
