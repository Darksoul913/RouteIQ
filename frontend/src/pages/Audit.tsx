import { useState } from 'react';
import { api } from '../api';
import { Badge, Drawer, Empty, Icon, KV, Metric, Panel } from '../components/ui';
import { go, useStore } from '../store';
import { cx, ms, parseRecord, shortHash, time, usd } from '../lib/format';
import type { AuditRecord, ChainStatus } from '../types';

function RecordDetail({ r }: { r: AuditRecord }) {
  const res = parseRecord(r);
  let violations: string[] = [];
  try {
    violations = JSON.parse(r.violations_json);
  } catch {
    /* ignore */
  }
  const rejected = res?.candidates.filter((c) => !c.passed) ?? [];
  return (
    <div className="inspector">
      <div className="row wrap gap-s">
        <Badge tone={r.auditor_compliant ? 'mint' : 'coral'} dot>{r.auditor_compliant ? 'compliant' : 'violation'}</Badge>
        {r.no_valid_model ? <Badge tone="amber">structured refusal</Badge> : <Badge tone="cyan">{r.chosen_model}</Badge>}
        <Badge tone="muted">block #{r.id}</Badge>
      </div>
      <div className="insp-sec">
        <div className="insp-h">Constraint outcome</div>
        <KV k="latency" v={`${ms(r.actual_latency_ms)} / ${ms(r.max_latency_ms)}`} />
        <KV k="cost" v={`${usd(r.actual_cost_usd)} / ${usd(r.max_cost_usd, 4)}`} />
        <KV k="capability" v={`${r.actual_capability.toFixed(2)} / requested ${r.min_capability.toFixed(2)}`} />
        {r.required_context ? <KV k="context" v={`${r.actual_context} / ${r.required_context}`} /> : null}
        {violations.length > 0 && <ul className="reasons t-coral">{violations.map((v) => <li key={v}>{v}</li>)}</ul>}
      </div>
      {res && (
        <div className="insp-sec">
          <div className="insp-h">Eligibility checks</div>
          <p className="small">{res.candidates.length - rejected.length} of {res.candidates.length} models passed. Rejected:</p>
          <ul className="reasons">
            {rejected.map((c) => <li key={c.model_id}><span className="mono">{c.model_id}</span>: {c.rejection_reasons.join('; ')}</li>)}
          </ul>
          {res.failover_chain.length > 0 && (
            <>
              <div className="insp-h">Fallback validation</div>
              <ul className="reasons">{res.failover_chain.map((f, i) => <li key={i} className="t-coral"><span className="mono">{f.model_id}</span> failed ({f.error}). The next candidate was re-checked against {ms(f.remaining_latency_ms)} remaining.</li>)}</ul>
            </>
          )}
        </div>
      )}
      <div className="insp-sec">
        <div className="insp-h">Hash chain</div>
        <KV k="prev_hash" v={<span className="hash">{r.prev_hash}</span>} />
        <KV k="curr_hash" v={<span className="hash">{r.curr_hash}</span>} />
        <p className="note">
          curr_hash = SHA-256(prev_hash | request_id | timestamp | chosen_model | latency | cost | compliant). The prompt and response text aren't part of the hash, so the chain detects changes to those routing fields only.
        </p>
      </div>
      <button className="btn ghost sm" onClick={() => go(`app/traces/${r.request_id}`)}>Open trace</button>
    </div>
  );
}

export default function Audit() {
  const { audit, health } = useStore();
  const [verify, setVerify] = useState<(ChainStatus & { at: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<AuditRecord | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setVerify({ ...(await api.verify()), at: new Date().toISOString() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const recs = audit?.records ?? [];

  return (
    <div className="audit">
      <div className="metrics three">
        <Metric label="Ledger records" value={audit?.total_records ?? '—'} sub={health ? <span className="mono">genesis {shortHash(health.genesis_hash, 8)}</span> : null} />
        <Metric label="Auditor violations" value={audit?.violations_count ?? '—'} tone={(audit?.violations_count ?? 0) > 0 ? 'coral' : 'mint'} sub="post-hoc, against the original constraints" />
        <Metric label="Chain status (last poll)" value={audit ? (audit.chain_valid ? 'intact' : 'broken') : '—'} tone={audit && !audit.chain_valid ? 'coral' : 'violet'} sub={audit?.chain_status.message} />
      </div>

      <Panel
        title="Cryptographic verification"
        sub="Recomputes every SHA-256 link on the server, from the genesis block to the newest record"
        actions={<button className="btn primary sm" onClick={run} disabled={busy}><Icon name="audit" size={14} /> {busy ? 'Verifying…' : 'Verify chain now'}</button>}
      >
        {err && <div className="callout tone-coral">{err}</div>}
        {verify ? (
          <div className={cx('verify', verify.valid ? 'ok' : 'bad')}>
            <Icon name={verify.valid ? 'check' : 'alert'} size={22} />
            <div>
              <b>{verify.valid ? 'Chain verified' : 'Verification failed'}</b>
              <div className="small">{verify.message}</div>
              <div className="mono small t-dim">{verify.total_records} records · checked {time(verify.at)}{verify.broken_at_id ? ` · broken at #${verify.broken_at_id}` : ''}</div>
            </div>
          </div>
        ) : (
          <p className="t-dim small">Not verified in this view yet.</p>
        )}
      </Panel>

      <Panel title="Audit records" sub="Newest 100 · click a row for the evidence">
        {recs.length === 0 ? (
          <Empty title="Ledger is empty" icon="audit">Every routed or refused request is audited and appended here.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Time</th><th>Model</th><th className="num">Latency / max</th><th className="num">Cost / max</th><th>Verdict</th><th>Block hash</th></tr></thead>
              <tbody>
                {recs.map((r) => (
                  <tr key={r.id} onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}>
                    <td className="mono t-dim">{r.id}</td>
                    <td className="mono t-dim">{time(r.timestamp)}</td>
                    <td className="mono">{r.chosen_model ?? <span className="t-amber">refused</span>}</td>
                    <td className="mono num">{ms(r.actual_latency_ms)} <span className="t-dim">/ {ms(r.max_latency_ms)}</span></td>
                    <td className="mono num">{usd(r.actual_cost_usd)} <span className="t-dim">/ {usd(r.max_cost_usd, 4)}</span></td>
                    <td>{r.auditor_compliant ? <Badge tone="mint">compliant</Badge> : <Badge tone="coral">violation</Badge>}</td>
                    <td className="mono t-dim">{shortHash(r.curr_hash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? <span className="mono">{open.request_id}</span> : ''}>
        {open && <RecordDetail r={open} />}
      </Drawer>
    </div>
  );
}
