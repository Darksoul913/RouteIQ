import { useMemo, useState } from 'react';
import RoutingNetwork, { degraded } from '../components/RoutingNetwork';
import Pipeline, { LANDING_STAGES } from '../components/Pipeline';
import { Badge, Drawer, Empty, Logo, Num, Sparkline } from '../components/ui';
import TopNav from '../components/TopNav';
import { ModelDetail } from './Fleet';
import { go, useStore, type Run } from '../store';
import { PRESETS } from '../lib/presets';
import { cx, isLocal, ms, parseRecord, percentile, time, usd } from '../lib/format';
import { splitThink } from '../components/Markdown';

function useLedgerStats() {
  const { audit } = useStore();
  const recs = audit?.records ?? [];
  return useMemo(() => {
    const chron = [...recs].reverse();
    const routed = chron.filter((r) => !r.no_valid_model);
    const withFallback = chron.map(parseRecord).filter((p) => (p?.failover_chain?.length ?? 0) > 0).length;
    return {
      recs,
      n: chron.length,
      refused: chron.length - routed.length,
      avgCost: routed.length ? routed.reduce((s, r) => s + r.actual_cost_usd, 0) / routed.length : 0,
      p95: percentile(routed.map((r) => r.actual_latency_ms), 0.95),
      fallback: withFallback,
      latSeries: routed.map((r) => r.actual_latency_ms),
      costSeries: routed.map((r) => r.actual_cost_usd),
    };
  }, [recs]);
}

function Scene() {
  const { models, health, online } = useStore();
  const s = useLedgerStats();
  const [filter, setFilter] = useState<'all' | 'local' | 'hosted'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const visibleIds = useMemo(
    () => (filter === 'all' ? null : new Set(models.filter((m) => (filter === 'local') === isLocal(m)).map((m) => m.id))),
    [models, filter],
  );
  const win = s.n ? `last ${s.n} requests` : 'no requests yet';
  const m = models.find((x) => x.id === open);

  return (
    <section className="scene" aria-label="Live routing overview">
      <RoutingNetwork variant="orbit" offsetX={0.6} heightFit={0.9} widthFit={0.52} models={models} visibleIds={visibleIds} focusId={open} onSelect={setOpen} ariaLabel="RouteIQ core with the live model fleet in orbit" />
      {online === false && <div className="viz-empty">The gateway isn't reachable. Start it with ./run.sh.</div>}

      <div className="scene-copy">
        <h1>
          Every request.
          <br />
          <span className="grad">The right model.</span>
        </h1>
        <p className="lede">RouteIQ checks each request against your cost, latency, capability and context limits, then routes it to the best model that fits, falling back safely when an endpoint fails.</p>
        <div className="row wrap gap-m">
          <a className="btn primary lg" href="#/app/live">Route a request</a>
          <a className="btn ghost lg glassy" href="#/app/traces">Inspect decisions</a>
        </div>
      </div>

      <div className="scene-status">
        <div className="row wrap gap-s">
          {health && <Badge tone={health.chain_valid ? 'violet' : 'coral'}>ledger {health.chain_valid ? 'intact' : 'broken'}</Badge>}
        </div>
        <div className="seg glassy" role="group" aria-label="Show endpoints">
          {(['all', 'local', 'hosted'] as const).map((f) => <button key={f} className={cx(filter === f && 'on')} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
        <ul className="scene-legend">
          <li><i className="sw-local" />local model</li>
          <li><i className="sw-hosted" />hosted API</li>
          <li><i className="sw-bad" />degraded</li>
          <li><i className="sw-arc" />arc fills to capability</li>
        </ul>
        <p className="scene-hint">Drag to turn the orbit. Hover a model for details, click to open it.</p>
      </div>

      <div className="scene-metrics" role="list" aria-label="Gateway metrics">
        <div role="listitem">
          <span>Requests audited</span>
          <b className="mono"><Num value={health?.total_audited_requests ?? 0} format={(n) => Math.round(n).toLocaleString()} /></b>
          <small>{s.refused} refused in {win}</small>
        </div>
        <div role="listitem">
          <span>Avg cost per request</span>
          <b className="mono"><Num value={s.avgCost} format={(n) => usd(n)} /></b>
          <small>{win}</small>
          <Sparkline values={s.costSeries} tone="mint" height={22} />
        </div>
        <div role="listitem">
          <span>P95 latency</span>
          <b className="mono"><Num value={s.p95} format={(n) => ms(n)} /></b>
          <small>end to end, {win}</small>
          <Sparkline values={s.latSeries} tone="cyan" height={22} />
        </div>
        <div role="listitem">
          <span>Needed a failover</span>
          <b className="mono">{s.n ? `${((s.fallback / s.n) * 100).toFixed(1)}%` : '—'}</b>
          <small>{s.fallback} of {s.n}</small>
        </div>
        <div role="listitem" className={(health?.auditor_violations ?? 0) > 0 ? 'bad' : 'good'}>
          <span>Constraint violations</span>
          <b className="mono">{health ? health.auditor_violations : '—'}</b>
          <small>found by the independent auditor</small>
        </div>
      </div>

      <Drawer open={!!m} onClose={() => setOpen(null)} title={m?.name ?? ''}>
        {m && (
          <>
            <ModelDetail m={m} />
            <a className="btn ghost sm" style={{ marginTop: 16 }} href={`#/app/fleet/${m.id}`}>Open in Model Fleet</a>
          </>
        )}
      </Drawer>
    </section>
  );
}

function Operations() {
  const { models, keys, session, resetSession } = useStore();
  const s = useLedgerStats();
  const bad = models.filter(degraded);
  const hosted = models.filter((m) => !isLocal(m));
  const hostedWithKey = hosted.filter((m) => m.env_key && keys[m.env_key]).length;
  const calls = models.reduce((a, m) => a + (m.telemetry?.requests ?? 0), 0);

  return (
    <section className="ops">
      <div className="ops-activity">
        <header className="ops-head">
          <h2>Recent activity</h2>
          <a className="link small" href="#/app/traces">All traces</a>
        </header>
        {s.recs.length === 0 ? (
          <Empty title="No requests yet">Route one below, or open <a href="#/app/live">Live Routing</a>.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Time</th><th>Model</th><th>Class</th><th className="num">Latency</th><th className="num">Cost</th><th>Outcome</th></tr>
              </thead>
              <tbody>
                {s.recs.slice(0, 8).map((r) => {
                  const p = parseRecord(r);
                  const fo = p?.failover_chain?.length ?? 0;
                  return (
                    <tr key={r.id} onClick={() => go(`app/traces/${r.request_id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`app/traces/${r.request_id}`)}>
                      <td className="mono t-dim">{time(r.timestamp)}</td>
                      <td className="mono">{r.chosen_model ?? '—'}</td>
                      <td>{p ? <Badge tone="violet">{p.estimator.tier}</Badge> : '—'}</td>
                      <td className="mono num">{ms(r.actual_latency_ms)}</td>
                      <td className="mono num">{usd(r.actual_cost_usd)}</td>
                      <td>
                        <span className="row gap-s">
                          {r.no_valid_model ? <Badge tone="amber">refused</Badge> : <Badge tone="mint">routed</Badge>}
                          {fo > 0 && <Badge tone="coral">{fo} failover</Badge>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ops-side">
        <div className="ops-card">
          <header className="ops-head">
            <h2>Fleet health</h2>
            <a className="link small" href="#/app/fleet">Model Fleet</a>
          </header>
          <div className="health-bar" aria-label={`${models.length - bad.length} of ${models.length} healthy`}>
            {models.map((m) => <i key={m.id} className={cx(degraded(m) ? 'bad' : isLocal(m) ? 'local' : 'hosted')} title={`${m.id}: ${degraded(m) ? 'degraded' : 'healthy'}`} />)}
          </div>
          <dl className="facts">
            <div><dt>Healthy</dt><dd className="mono">{models.length - bad.length} of {models.length}</dd></div>
            <div><dt>Local / hosted</dt><dd className="mono">{models.length - hosted.length} / {hosted.length}</dd></div>
            <div><dt>Hosted with API key</dt><dd className="mono">{hostedWithKey} of {hosted.length}</dd></div>
            <div><dt>Calls since server start</dt><dd className="mono">{calls}</dd></div>
          </dl>
          {bad.length > 0 && <p className="note t-coral">Degraded: {bad.map((m) => m.id).join(', ')}</p>}
          {hostedWithKey < hosted.length && <p className="note">Hosted models without a key are answered by the simulator. <a href="#/app/keys">Add keys</a></p>}
        </div>

        <div className="ops-card">
          <header className="ops-head">
            <h2>This browser session</h2>
            <button className="btn ghost xs" onClick={resetSession}>Reset</button>
          </header>
          <dl className="facts">
            <div><dt>Requests</dt><dd className="mono">{session.queries} ({session.refusals} refused)</dd></div>
            <div><dt>RouteIQ spend</dt><dd className="mono t-mint">{usd(session.cost, 5)}</dd></div>
            <div><dt>Reference model cost</dt><dd className="mono">{usd(session.baselineCost, 5)}</dd></div>
            <div><dt>Tokens in / out</dt><dd className="mono">{session.tokensIn} / {session.tokensOut}</dd></div>
          </dl>
          {session.baselineName && <p className="note">Reference cost prices the same tokens on {session.baselineName}. It comes from the registry, not a measured run.</p>}
        </div>
      </div>
    </section>
  );
}

function Demo() {
  const { runRoute, inFlight, online } = useStore();
  const [preset, setPreset] = useState(PRESETS[0]);
  const [prompt, setPrompt] = useState(PRESETS[0].prompt);
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!prompt.trim()) return;
    setError(null);
    setRun(null);
    const req = { prompt, max_latency_ms: preset.max_latency_ms, max_cost_usd: preset.max_cost_usd, min_capability: preset.min_capability, preference: preset.preference, expected_output_tokens: 180 };
    try {
      setRun({ req, res: await runRoute(req) });
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const answer = run && !run.res.no_valid_model ? splitThink(run.res.response_text).body : null;

  return (
    <section className="l-demo" id="demo">
      <div className="l-sec-head">
        <h2>Try a request</h2>
        <p className="t-dim">This sends a real request to <code>/route</code>. The result replays on the orbit above, and is audited and written to the ledger like any other request.</p>
      </div>
      <div className="demo-box">
        <div className="demo-input">
          <div className="chips" role="radiogroup" aria-label="Sample requests">
            {PRESETS.map((p) => (
              <button key={p.key} role="radio" aria-checked={p.key === preset.key} className={cx('chip', p.key === preset.key && 'on')} onClick={() => { setPreset(p); setPrompt(p.prompt); }}>
                <b>{p.label}</b>
                <span className="mono">{p.hint}</span>
              </button>
            ))}
          </div>
          <div className="demo-row">
            <input aria-label="Test prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button className="btn primary" onClick={submit} disabled={inFlight || !online || !prompt.trim()}>{inFlight ? 'Routing…' : 'Route request'}</button>
          </div>
        </div>
        <Pipeline stages={LANDING_STAGES} result={run?.res ?? null} pref={preset.preference} running={inFlight && !run} error={error} onInspect={() => run && go(`app/traces/${run.res.request_id}`)} />
        {run && (
          <div className="demo-foot">
            <p className="small">
              {answer ? <><span className="t-dim">Response: </span>{answer.slice(0, 220)}{answer.length > 220 ? '…' : ''}</> : <span className="t-amber">{run.res.closest_miss_suggestion ?? 'Refused: no model meets every constraint.'}</span>}
            </p>
            <button className="btn ghost" onClick={() => go(`app/traces/${run.res.request_id}`)}>Open the full trace</button>
          </div>
        )}
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section className="l-caps">
      <div className="l-sec-head">
        <h2>Rules decide. AI only advises.</h2>
      </div>
      <div className="caps-grid">
        <article className="cap cap-big">
          <div className="cap-ill gates" aria-hidden="true">
            {['circuit', 'context', 'cost', 'latency', 'capability'].map((g, i) => (
              <div key={g} className="gate" style={{ ['--i' as string]: i }}>
                <span className="mono">{g}</span>
                <i />
              </div>
            ))}
            <div className="flow">
              {Array.from({ length: 7 }, (_, i) => <b key={i} className={i % 3 === 1 ? 'blocked' : ''} style={{ ['--d' as string]: `${i * 0.8}s`, ['--stop' as string]: `${20 + (i % 5) * 14}%` }} />)}
            </div>
          </div>
          <h3>Constraint-aware routing</h3>
          <p>Before any ranking happens, every model is checked against the cost, context, capability and latency limits, plus its circuit-breaker health. A model that fails any check is dropped and the reason is recorded.</p>
        </article>
        <article className="cap">
          <div className="cap-ill budget" aria-hidden="true">
            <div className="bar"><span className="spent" /><span className="rem" /></div>
            <div className="mono small t-dim">L<sub>rem</sub> = L<sub>orig</sub> − t<sub>spent</sub></div>
          </div>
          <h3>Constraint-preserving failover</h3>
          <p>If a model fails, the time it used is subtracted from the budget. Each fallback is re-checked against what's left. If nothing fits, the gateway refuses rather than relaxing a limit.</p>
        </article>
        <article className="cap">
          <div className="cap-ill tiers" aria-hidden="true">
            {[['easy', 0.3], ['medium', 0.65], ['hard', 0.8]].map(([t, v]) => (
              <div key={t as string} className="tier">
                <span className="mono">{t}</span>
                <i style={{ ['--v' as string]: v as number }} />
                <span className="mono t-dim">≥{(v as number).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <h3>Complexity-aware selection</h3>
          <p>Laya System 1 estimates how hard each prompt is. The tier sets a minimum capability, so easy requests aren't sent to the most expensive model. When the estimators are unsure or disagree, the tier is raised to be safe.</p>
        </article>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="landing home">
      <TopNav active="overview" />

      <Scene />
      <Operations />
      <Demo />
      <Capabilities />

      <footer className="l-foot">
        <div className="row gap-s">
          <Logo size={20} />
          <b>RouteIQ</b>
          <span className="t-dim mono small">VORTEXA 3.0 engine</span>
        </div>
        <div className="t-dim small">Team PaniPuri Paglus, D.I.T. Pimpri, Pune. Domain 2: AI Systems &amp; Infrastructure (A-01)</div>
        <div className="row gap-m small">
          <a href="#/app/live">Gateway</a>
          <a href="#/app/traces">Traces</a>
          <a href="#/app/audit">Audit &amp; proofs</a>
        </div>
      </footer>
    </div>
  );
}
