import { useState } from 'react';
import { api } from '../api';
import { Badge, Empty, Icon, Panel } from '../components/ui';
import { useStore } from '../store';
import { PRESETS } from '../lib/presets';
import { PREFERENCES, cx, ms, percentile, prefLabel, usd } from '../lib/format';
import type { BenchmarkResult, Preference, RouteResponse } from '../types';

interface Arm {
  pref: Preference;
  results: RouteResponse[];
}

function summarize(rs: RouteResponse[]) {
  const routed = rs.filter((r) => !r.no_valid_model);
  const lats = routed.map((r) => r.actual_metrics.total_latency_ms);
  const dist: Record<string, number> = {};
  routed.forEach((r) => (dist[r.chosen_model!] = (dist[r.chosen_model!] ?? 0) + 1));
  return {
    cost: routed.reduce((s, r) => s + r.actual_metrics.total_cost_usd, 0),
    avgLat: lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 0,
    p95: percentile(lats, 0.95),
    refused: rs.length - routed.length,
    fallbacks: rs.filter((r) => r.failover_chain.length > 0).length,
    violations: rs.filter((r) => !r.auditor.compliant).length,
    dist,
  };
}

function Replay() {
  const { runRoute, inFlight, online } = useStore();
  const [a, setA] = useState<Preference>('lowest_cost');
  const [b, setB] = useState<Preference>('balanced_pareto');
  const [lat, setLat] = useState(2500);
  const [cost, setCost] = useState(0.02);
  const [arms, setArms] = useState<Arm[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    setArms(null);
    const out: Arm[] = [{ pref: a, results: [] }, { pref: b, results: [] }];
    try {
      for (const arm of out) {
        for (const [i, p] of PRESETS.entries()) {
          setProgress(`${prefLabel(arm.pref)} · ${i + 1}/${PRESETS.length}`);
          arm.results.push(await runRoute({ prompt: p.prompt, max_latency_ms: lat, max_cost_usd: cost, min_capability: 0, preference: arm.pref, expected_output_tokens: 180 }));
        }
      }
      setArms(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const sums = arms?.map((x) => ({ ...x, s: summarize(x.results) }));
  const allModels = sums ? [...new Set(sums.flatMap((x) => Object.keys(x.s.dist)))] : [];

  return (
    <Panel
      title="Policy A vs B · request replay"
      sub={`Runs the ${PRESETS.length} sample prompts through /route under two preferences, with the same limits. These are real executions: they're written to the audit ledger and update latency telemetry.`}
    >
      <div className="lab-controls">
        <label className="field"><span className="field-head"><span>Policy A</span></span>
          <select value={a} onChange={(e) => setA(e.target.value as Preference)}>{PREFERENCES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        </label>
        <label className="field"><span className="field-head"><span>Policy B</span></span>
          <select value={b} onChange={(e) => setB(e.target.value as Preference)}>{PREFERENCES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        </label>
        <label className="field"><span className="field-head"><span>Max latency</span><b className="mono">{ms(lat)}</b></span>
          <input type="range" min={200} max={5000} step={50} value={lat} onChange={(e) => setLat(+e.target.value)} />
        </label>
        <label className="field"><span className="field-head"><span>Max cost</span><b className="mono">{usd(cost, 4)}</b></span>
          <input type="range" min={0.0005} max={0.05} step={0.0005} value={cost} onChange={(e) => setCost(+e.target.value)} />
        </label>
        <button className="btn primary" onClick={run} disabled={inFlight || !!progress || online === false}>
          <Icon name="play" size={14} /> {progress ? `Running ${progress}` : `Run ${PRESETS.length * 2} requests`}
        </button>
      </div>
      {err && <div className="callout tone-coral">Stopped: {err}</div>}
      {sums ? (
        <>
          <div className="table-wrap">
            <table className="table compare">
              <thead><tr><th /><th>A · {prefLabel(sums[0].pref)}</th><th>B · {prefLabel(sums[1].pref)}</th></tr></thead>
              <tbody>
                {([
                  ['Total cost', (s) => usd(s.cost)],
                  ['Avg latency', (s) => ms(s.avgLat)],
                  ['P95 latency', (s) => ms(s.p95)],
                  ['Refusals', (s) => String(s.refused)],
                  ['Requests with failover', (s) => String(s.fallbacks)],
                  ['Auditor violations', (s) => String(s.violations)],
                ] as [string, (s: ReturnType<typeof summarize>) => string][]).map(([k, f]) => (
                  <tr key={k}><td>{k}</td><td className="mono">{f(sums[0].s)}</td><td className="mono">{f(sums[1].s)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dist">
            <div className="insp-h">Routing distribution</div>
            {allModels.map((m) => (
              <div key={m} className="dist-row">
                <span className="mono">{m}</span>
                {sums.map((x, i) => (
                  <span key={i} className={cx('dist-bar', i ? 'tone-violet' : 'tone-cyan')}>
                    <i style={{ width: `${((x.s.dist[m] ?? 0) / PRESETS.length) * 100}%` }} />
                    <em className="mono">{x.s.dist[m] ?? 0}</em>
                  </span>
                ))}
              </div>
            ))}
            <div className="small t-dim row gap-m"><span><i className="sw tone-cyan" /> A</span><span><i className="sw tone-violet" /> B</span></div>
          </div>
          <p className="note">Answer quality isn't compared, because the gateway has no answer-quality evaluator. Use <code>./run.sh --eval</code> to check the benchmark tasks offline.</p>
        </>
      ) : (
        !progress && <Empty title="No comparison yet" icon="lab">Pick two preferences and run the replay.</Empty>
      )}
    </Panel>
  );
}

function Baselines() {
  const [res, setRes] = useState<BenchmarkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.benchmark(30));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const rows = res ? ([['Always strongest', res.always_strongest], ['Always cheapest', res.always_cheapest], ['RouteIQ', res.routeiq]] as const) : [];
  return (
    <Panel
      title="Baseline comparison"
      sub="POST /benchmark/compare over the 30 benchmark prompts (limit 1000 ms · $0.005)"
      actions={<button className="btn ghost sm" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run comparison'}</button>}
    >
      <div className="callout tone-amber small">
        <b>Modelled, not measured.</b> Both baseline columns are calculated from registry base latency and pricing, without calling any model. The RouteIQ column goes through the executor with simulated delays turned off. The baselines also don't account for the estimator's tier raise. Treat this as a sanity check, not a benchmark result.
      </div>
      {err && <div className="callout tone-coral">{err}</div>}
      {res && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Strategy</th><th className="num">Total cost</th><th className="num">Avg latency</th><th className="num">P95</th><th className="num">Flagged</th></tr></thead>
            <tbody>
              {rows.map(([k, s]) => (
                <tr key={k} className={k === 'RouteIQ' ? 'on' : ''}>
                  <td>{k}</td>
                  <td className="mono num">{usd(s.total_cost_usd)}</td>
                  <td className="mono num">{ms(s.avg_latency_ms)}</td>
                  <td className="mono num">{ms(s.p95_latency_ms)}</td>
                  <td className="mono num">{s.violations} <span className="t-dim">({s.violation_rate_pct}%)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            "Flagged" counts differently for each row. Always strongest is flagged when the base latency or cost goes over the limit. Always cheapest is flagged when its capability is below the task's minimum. RouteIQ is flagged when it goes over a limit without refusing. RouteIQ costs <Badge tone="cyan">{res.cost_savings_vs_strongest_pct}%</Badge> less than always-strongest here, but RouteIQ refuses some requests (refusals cost $0), so the totals don't cover the same set of requests.
          </p>
        </div>
      )}
    </Panel>
  );
}

export default function Lab() {
  return (
    <div className="lab">
      <Replay />
      <Baselines />
    </div>
  );
}
