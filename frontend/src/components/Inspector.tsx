import type { Candidate, RouteRequest, RouteResponse } from '../types';
import { candState, explain, paretoScores, STATE_META, badgeTone } from '../lib/decision';
import { cx, ms, prefLabel, shortHash, time, usd } from '../lib/format';
import { Badge, Check, KV } from './ui';
import Markdown, { splitThink } from './Markdown';

export type ReqLike = Pick<RouteRequest, 'max_latency_ms' | 'max_cost_usd' | 'min_capability' | 'preference'> & {
  required_context?: number | null;
  prompt?: string;
};

export function DecisionInspector({ req, res, onInspect }: { req: ReqLike; res: RouteResponse; onInspect?: (c: Candidate) => void }) {
  const a = res.actual_metrics;
  const chosen = res.candidates.find((c) => c.model_id === res.chosen_model);
  const e = res.estimator;
  return (
    <div className="inspector">
      <p className="explain">{explain(res, req.preference)}</p>

      <div className="insp-sec">
        <div className="insp-h">Outcome</div>
        <div className="row wrap gap-s">
          {res.no_valid_model ? <Badge tone="coral" dot>Refused · no feasible model</Badge> : <Badge tone="mint" dot>Routed to {res.chosen_model}</Badge>}
          <Badge tone={badgeTone(a.badge)} title="Execution mode reported by the backend">{a.badge}</Badge>
          <Badge tone={res.auditor.compliant ? 'mint' : 'coral'}>{res.auditor.compliant ? 'Auditor: compliant' : 'Auditor: violation'}</Badge>
        </div>
        {/Apple Silicon|SIMULATED/.test(a.badge) && (
          <p className="note">
            This mode means the backend generated the reply itself, without calling a real model: either the built-in simulator, or local text synthesis when llama-cpp isn't installed. The latency and cost figures come from the model registry.
          </p>
        )}
      </div>

      <div className="insp-sec">
        <div className="insp-h">Constraints vs observed</div>
        <Check ok={res.no_valid_model || a.total_latency_ms <= req.max_latency_ms + 5} label={<>latency {ms(a.total_latency_ms)} / max {ms(req.max_latency_ms)}</>} />
        <Check ok={res.no_valid_model || a.total_cost_usd <= req.max_cost_usd * 1.01} label={<>cost {usd(a.total_cost_usd)} / max {usd(req.max_cost_usd, 4)}</>} />
        <Check
          ok={res.no_valid_model || a.model_capability >= e.required_capability - 1e-4}
          label={<>capability {a.model_capability.toFixed(2)} / effective min {e.required_capability.toFixed(2)} <span className="t-dim">(you asked {req.min_capability.toFixed(2)})</span></>}
        />
        {req.required_context ? <Check ok={res.no_valid_model || a.model_context >= req.required_context} label={<>context {a.model_context} / needs {req.required_context}</>} /> : null}
      </div>

      {chosen && (
        <div className="insp-sec">
          <div className="insp-h">Predicted vs actual</div>
          <KV k="latency" v={<>{ms(chosen.predicted_latency_ms)} → {ms(a.model_execution_ms ?? a.total_latency_ms)}</>} />
          <KV k="cost" v={<>{usd(chosen.predicted_cost_usd)} → {usd(a.total_cost_usd)}</>} />
          <KV k="tokens in / out" v={`${a.tokens_in ?? 0} / ${a.tokens_out ?? 0}`} />
        </div>
      )}

      <div className="insp-sec">
        <div className="insp-h">Laya System 1 estimate</div>
        <KV k="tier" v={e.raw_tier !== e.tier ? `${e.raw_tier} → ${e.tier}` : e.tier} />
        <KV k="confidence" v={e.confidence.toFixed(3)} />
        <KV k="estimator path" v={e.path} />
        <KV k="estimation time" v={`${e.latency_ms.toFixed(2)} ms`} />
        {e.elevated && <p className="note">Uncertainty hedge: {e.elevation_reason}</p>}
      </div>

      <div className="insp-sec">
        <div className="insp-h">Fallback chain</div>
        {res.failover_chain.length === 0 ? (
          <p className="t-dim small">{res.no_valid_model ? 'Nothing was attempted. The refusal happened before any model ran.' : 'No failover. The first-ranked model succeeded.'}</p>
        ) : (
          <ol className="chain">
            {res.failover_chain.map((f, i) => (
              <li key={i} className="t-coral">
                <span className="mono">{f.model_id}</span> failed after {ms(f.time_spent_ms)}
                <div className="t-dim small">{f.error}</div>
                <div className="small mono">remaining: {ms(f.remaining_latency_ms)} · {usd(f.remaining_cost_usd, 5)}</div>
              </li>
            ))}
            {res.chosen_model && <li className="t-mint">Re-checked against the remaining budget, then ran on <span className="mono">{res.chosen_model}</span></li>}
          </ol>
        )}
      </div>

      <details className="insp-sec disclose">
        <summary>All candidates ({res.candidates.length})</summary>
        <div className="cand-list">
          {res.candidates.map((c) => {
            const st = candState(c, res);
            return (
              <button key={c.model_id} className="cand-row" onClick={() => onInspect?.(c)}>
                <span className="mono">{c.model_id}</span>
                <Badge tone={STATE_META[st].tone}>{STATE_META[st].label}</Badge>
              </button>
            );
          })}
        </div>
      </details>

      {res.cost_matrix && !res.no_valid_model && (
        <details className="insp-sec disclose">
          <summary>Cost compared with the reference model</summary>
          <KV k="reference model" v={res.cost_matrix.baseline_model_name} mono={false} />
          <KV k="reference cost" v={usd(res.cost_matrix.baseline_cost_usd)} />
          <KV k="routed cost" v={usd(res.cost_matrix.chosen_cost_usd)} />
          <KV k="difference" v={`${usd(res.cost_matrix.money_saved_usd)} (${res.cost_matrix.savings_percentage}%)`} />
          <p className="note">The backend's reference is the first 'hard'-tier model in the registry, priced at this request's token counts. It is not a measured run.</p>
        </details>
      )}

      {res.auditor.chain_hash && (
        <div className="insp-sec">
          <div className="insp-h">Ledger</div>
          <KV k="request" v={res.request_id} />
          <KV k="block hash" v={shortHash(res.auditor.chain_hash, 14)} />
        </div>
      )}
    </div>
  );
}

export function CandidateDetail({ c, res, req }: { c: Candidate; res: RouteResponse; req: ReqLike }) {
  const st = candState(c, res);
  const f = res.failover_chain.find((x) => x.model_id === c.model_id);
  const e = res.estimator;
  return (
    <div className="inspector">
      <div className="row wrap gap-s">
        <Badge tone={STATE_META[st].tone} dot>{STATE_META[st].label}</Badge>
        <Badge tone="muted">circuit {c.circuit_state}</Badge>
      </div>
      <div className="insp-sec">
        <div className="insp-h">Hard constraints (evaluated against the original budget)</div>
        <Check ok={c.circuit_state === 'CLOSED' || c.circuit_state === 'HALF_OPEN'} label={<>endpoint health: circuit {c.circuit_state}</>} />
        <Check ok={c.context_fit} label={<>context window fits{req.required_context ? ` ${req.required_context} tokens` : ''}</>} />
        <Check ok={c.cost_fit} label={<>predicted cost {usd(c.predicted_cost_usd)} ≤ {usd(req.max_cost_usd, 4)}</>} />
        <Check ok={c.latency_fit} label={<>predicted latency {ms(c.predicted_latency_ms)} ≤ {ms(req.max_latency_ms)}</>} />
        <Check ok={c.capability_fit} label={<>capability {c.capability_score.toFixed(2)} ≥ {e.required_capability.toFixed(2)}</>} />
      </div>
      {c.rejection_reasons.length > 0 && (
        <div className="insp-sec">
          <div className="insp-h">Rejection reasons from the engine</div>
          <ul className="reasons">{c.rejection_reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {f && (
        <div className="insp-sec">
          <div className="insp-h">Execution attempt</div>
          <p className="t-coral small">{f.error}</p>
          <KV k="time spent" v={ms(f.time_spent_ms)} />
          <KV k="budget left after" v={`${ms(f.remaining_latency_ms)} · ${usd(f.remaining_cost_usd, 5)}`} />
        </div>
      )}
      {st === 'selected' && <p className="note">This was the highest-ranked candidate that passed every constraint under the remaining budget, ranked by {prefLabel(req.preference).toLowerCase()}.</p>}
      {st === 'eligible' && <p className="note">Passed every hard constraint but ranked below the selected model, so it stayed available as a fallback.</p>}
      {req.preference === 'balanced_pareto' && c.passed && <KV k="pareto score (recomputed)" v={paretoScores(res.candidates.filter((x) => x.passed)).get(c.model_id)!.toFixed(4)} />}
    </div>
  );
}

/** Ordered execution events for one request, with timing. */
export function TraceTimeline({ req, res }: { req: ReqLike; res: RouteResponse }) {
  const a = res.actual_metrics;
  const events: { title: string; t?: number; tone: 'cyan' | 'mint' | 'coral' | 'amber' | 'violet'; body: React.ReactNode }[] = [];
  events.push({ title: 'Request received', tone: 'cyan', body: <><span className="mono">{res.request_id}</span> · {time(res.timestamp)} · {prefLabel(req.preference)}</> });
  events.push({
    title: 'Complexity estimation',
    t: res.estimator.latency_ms,
    tone: 'violet',
    body: <>Tier <b>{res.estimator.tier}</b>{res.estimator.raw_tier !== res.estimator.tier ? <> (raised from {res.estimator.raw_tier})</> : null} · confidence {res.estimator.confidence.toFixed(2)} · min capability {res.estimator.required_capability.toFixed(2)}</>,
  });
  const passed = res.candidates.filter((c) => c.passed).length;
  events.push({ title: 'Candidate evaluation', tone: passed ? 'cyan' : 'coral', body: <>{passed} of {res.candidates.length} models passed the circuit, context, cost, latency and capability checks</> });
  res.failover_chain.forEach((f) =>
    events.push({ title: `Attempt failed: ${f.model_id}`, t: f.time_spent_ms, tone: 'coral', body: <>{f.error}<div className="mono small">budget left: {ms(f.remaining_latency_ms)}</div></> }),
  );
  if (res.no_valid_model) {
    events.push({ title: 'Structured refusal', tone: 'amber', body: res.closest_miss_suggestion ?? 'No feasible model under the remaining budget.' });
  } else {
    events.push({ title: `Executed on ${res.chosen_model}`, t: a.model_execution_ms, tone: 'mint', body: <><span className="mono">{a.badge}</span> · {a.tokens_in ?? 0} in / {a.tokens_out ?? 0} out · {usd(a.total_cost_usd)}</> });
  }
  events.push({
    title: res.auditor.compliant ? 'Independent audit passed' : 'Independent audit found violations',
    tone: res.auditor.compliant ? 'mint' : 'coral',
    body: res.auditor.violations?.length ? res.auditor.violations.join('; ') : 'Latency, cost, capability and context all checked against the original constraints',
  });
  if (res.auditor.chain_hash) events.push({ title: 'Written to hash-chained ledger', tone: 'violet', body: <span className="mono">{shortHash(res.auditor.chain_hash, 16)}</span> });

  const total = Math.max(1, a.total_latency_ms);
  return (
    <div className="timeline">
      <div className="tl-bar" aria-label="Latency breakdown">
        <span className="seg tone-violet" style={{ flexGrow: res.estimator.latency_ms }} title={`estimation ${res.estimator.latency_ms.toFixed(1)} ms`} />
        {res.failover_chain.map((f, i) => <span key={i} className="seg tone-coral" style={{ flexGrow: f.time_spent_ms }} title={`${f.model_id} failed ${f.time_spent_ms} ms`} />)}
        {!res.no_valid_model && <span className="seg tone-mint" style={{ flexGrow: a.model_execution_ms ?? 0 }} title={`execution ${a.model_execution_ms} ms`} />}
      </div>
      <div className="tl-scale mono small t-dim"><span>0</span><span>{ms(total)} total</span></div>
      <ol className="tl">
        {events.map((ev, i) => (
          <li key={i} className={cx('tl-ev', `tone-${ev.tone}`)} style={{ animationDelay: `${i * 60}ms` }}>
            <span className="tl-dot" />
            <div className="tl-head">
              <span>{ev.title}</span>
              {ev.t != null && <span className="mono small t-dim">{ev.t.toFixed(ev.t < 10 ? 2 : 0)} ms</span>}
            </div>
            <div className="tl-body">{ev.body}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ResponseView({ res }: { res: RouteResponse }) {
  const { think, body } = splitThink(res.response_text || '');
  return (
    <div className="response">
      {think && (
        <details className="think">
          <summary>Reasoning trace ({think.split(/\s+/).length} words)</summary>
          <pre>{think}</pre>
        </details>
      )}
      <Markdown text={body} />
    </div>
  );
}
