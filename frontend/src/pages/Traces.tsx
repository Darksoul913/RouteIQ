import { useMemo, useState } from 'react';
import { CandidateDetail, DecisionInspector, ResponseView, TraceTimeline, type ReqLike } from '../components/Inspector';
import { Badge, Drawer, Empty, Icon, Panel } from '../components/ui';
import { go, useStore } from '../store';
import { cx, ms, parseRecord, time, usd } from '../lib/format';
import type { Candidate } from '../types';

export default function Traces({ focus }: { focus?: string }) {
  const { audit } = useStore();
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState<'all' | 'routed' | 'refused' | 'fallback'>('all');
  const [inspect, setInspect] = useState<Candidate | null>(null);

  const rows = useMemo(
    () =>
      (audit?.records ?? []).map((r) => {
        const res = parseRecord(r);
        let req: ReqLike;
        try {
          req = JSON.parse(r.request_json);
        } catch {
          req = { max_latency_ms: r.max_latency_ms, max_cost_usd: r.max_cost_usd, min_capability: r.min_capability, preference: r.preference as ReqLike['preference'], required_context: r.required_context, prompt: r.prompt };
        }
        return { r, res, req };
      }),
    [audit],
  );
  const filtered = rows.filter(({ r, res }) => {
    const fo = (res?.failover_chain?.length ?? 0) > 0;
    if (outcome === 'routed' && r.no_valid_model) return false;
    if (outcome === 'refused' && !r.no_valid_model) return false;
    if (outcome === 'fallback' && !fo) return false;
    return !q || `${r.request_id} ${r.chosen_model ?? ''} ${r.prompt}`.toLowerCase().includes(q.toLowerCase());
  });
  const found = rows.find((x) => x.r.request_id === focus);
  // response_json is stored before the ledger hash is attached; merge the record's hash back in.
  const sel = found && { ...found, res: found.res && { ...found.res, auditor: { ...found.res.auditor, chain_hash: found.r.curr_hash } } };

  return (
    <div className="traces">
      <Panel
        className="tr-list"
        title="Request traces"
        sub={`Newest 100 records from the audit ledger (${audit?.total_records ?? 0} in total)`}
        actions={
          <label className="search">
            <Icon name="search" size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, model, prompt" aria-label="Search traces" />
          </label>
        }
      >
        <div className="filters">
          <div className="seg" role="group" aria-label="Outcome">
            {(['all', 'routed', 'refused', 'fallback'] as const).map((o) => <button key={o} className={cx(outcome === o && 'on')} onClick={() => setOutcome(o)}>{o}</button>)}
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty title="No traces yet">Requests appear here once they are routed. Try <a href="#/app/live">Live Routing</a>.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Time</th><th>Request</th><th>Class</th><th>Model</th><th className="num">Latency</th><th className="num">Cost</th><th className="num">Tokens</th><th>Outcome</th></tr>
              </thead>
              <tbody>
                {filtered.map(({ r, res }) => {
                  const fo = res?.failover_chain?.length ?? 0;
                  const a = res?.actual_metrics;
                  return (
                    <tr key={r.id} className={cx(r.request_id === focus && 'on')} onClick={() => go(`app/traces/${r.request_id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`app/traces/${r.request_id}`)}>
                      <td className="mono t-dim">{time(r.timestamp)}</td>
                      <td className="mono">{r.request_id}</td>
                      <td>{res ? <Badge tone="violet">{res.estimator.tier}</Badge> : '—'}</td>
                      <td className="mono">{r.chosen_model ?? '—'}</td>
                      <td className="mono num">{ms(r.actual_latency_ms)}</td>
                      <td className="mono num">{usd(r.actual_cost_usd)}</td>
                      <td className="mono num">{a?.tokens_in != null ? `${a.tokens_in}/${a.tokens_out}` : '—'}</td>
                      <td>
                        <span className="row gap-s">
                          {r.no_valid_model ? <Badge tone="amber">refused</Badge> : <Badge tone="mint">routed</Badge>}
                          {fo > 0 && <Badge tone="coral">{fo} failover</Badge>}
                          {!r.auditor_compliant && <Badge tone="coral">violation</Badge>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <Empty title="No traces match" icon="search" />}
          </div>
        )}
      </Panel>

      <Drawer open={!!sel} onClose={() => go('app/traces')} title={sel ? <span className="mono">{sel.r.request_id}</span> : ''}>
        {sel && (sel.res ? (
          <div className="trace-detail">
            <div className="insp-sec">
              <div className="insp-h">Prompt</div>
              <p className="prompt-quote">{sel.r.prompt}</p>
            </div>
            <div className="insp-sec">
              <div className="insp-h">Execution timeline</div>
              <TraceTimeline req={sel.req} res={sel.res} />
            </div>
            <div className="insp-sec">
              <div className="insp-h">Decision</div>
              <DecisionInspector req={sel.req} res={sel.res} onInspect={setInspect} />
            </div>
            {!sel.res.no_valid_model && (
              <details className="insp-sec disclose">
                <summary>Response</summary>
                <ResponseView res={sel.res} />
              </details>
            )}
            {inspect && (
              <div className="insp-sec sub-inspect">
                <div className="row between"><div className="insp-h">Candidate: {inspect.model_name}</div><button className="btn ghost xs" onClick={() => setInspect(null)}>close</button></div>
                <CandidateDetail c={inspect} res={sel.res} req={sel.req} />
              </div>
            )}
          </div>
        ) : (
          <Empty title="This record has no parseable response payload" icon="alert" />
        ))}
      </Drawer>
    </div>
  );
}
