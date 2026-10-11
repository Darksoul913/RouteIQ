import { useMemo, useState } from 'react';
import RoutingNetwork, { degraded } from '../components/RoutingNetwork';
import { Badge, Empty, Icon, KV, Panel } from '../components/ui';
import { go, useStore } from '../store';
import type { Model } from '../types';
import { ctx, cx, int, isLocal, ms, time, usd } from '../lib/format';

function statusOf(m: Model): { label: string; tone: 'mint' | 'amber' | 'coral' } {
  if (m.circuit_breaker.state === 'OPEN') return { label: `circuit open · ${m.circuit_breaker.cooldown_remaining_sec}s`, tone: 'coral' };
  if (m.circuit_breaker.state === 'HALF_OPEN') return { label: 'half-open · probing', tone: 'amber' };
  if (m.chaos.kill_switch) return { label: 'killed (chaos)', tone: 'coral' };
  if (degraded(m)) return { label: 'fault injected', tone: 'amber' };
  return { label: 'healthy', tone: 'mint' };
}

export function ModelDetail({ m }: { m: Model }) {
  const { keys, audit } = useStore();
  const st = statusOf(m);
  const local = isLocal(m);
  const meta = m.gguf_meta ?? {};
  const ggufFound = Object.keys(meta).length > 0;
  const recent = (audit?.records ?? []).filter((r) => r.chosen_model === m.id).slice(0, 6);
  const t = m.telemetry;
  return (
    <div className="model-detail">
      <div className="md-head">
        <div>
          <div className="md-name">{m.name}</div>
          <div className="mono small t-dim">{m.id} · {m.family}</div>
        </div>
        <div className="row wrap gap-s">
          <Badge tone={local ? 'cyan' : 'violet'}>{local ? 'Local GGUF' : `Hosted · ${m.api_provider ?? 'API'}`}</Badge>
          <Badge tone={st.tone} dot>{st.label}</Badge>
        </div>
      </div>

      <div className="md-grid">
        <div className="md-block">
          <div className="insp-h">Registry (from registry.json)</div>
          <KV k="tier" v={m.tier} />
          <KV k="capability" v={m.capability_score.toFixed(2)} />
          <KV k="context window" v={`${int(m.context_window)} (${ctx(m.context_window)})`} />
          <KV k="price in / out per 1k" v={`${usd(m.input_cost_per_1k, 5)} / ${usd(m.output_cost_per_1k, 5)}`} />
          <KV k="base latency" v={ms(m.base_latency_ms)} />
        </div>
        <div className="md-block">
          <div className="insp-h">Live telemetry (since server start)</div>
          {t.requests === 0 ? (
            <p className="t-dim small">No calls yet. Routing predictions use the base latency until telemetry exists.</p>
          ) : (
            <>
              <KV k="calls / errors" v={`${t.requests} / ${t.errors} (${(t.error_rate * 100).toFixed(1)}%)`} />
              <KV k="EMA latency" v={ms(t.ema_latency_ms)} />
              <KV k="p95 latency (rolling 50)" v={ms(t.p95_latency_ms)} />
              <KV k="tokens in / out" v={`${int(t.total_tokens_in)} / ${int(t.total_tokens_out)}`} />
            </>
          )}
          <KV k="circuit" v={`${m.circuit_breaker.state} · ${m.circuit_breaker.consecutive_failures} consecutive fails · ${m.circuit_breaker.total_trips} trips`} />
        </div>
        <div className="md-block">
          <div className="insp-h">Endpoint</div>
          {local ? (
            <>
              <KV k="gguf file" v={m.gguf_file ?? '—'} />
              {ggufFound ? (
                Object.entries(meta).slice(0, 5).map(([k, v]) => <KV key={k} k={k.replace(/_/g, ' ')} v={String(v)} />)
              ) : (
                <p className="note">This GGUF file wasn't found in the model directory, so the executor falls back to its simulator for this model.</p>
              )}
            </>
          ) : (
            <>
              <KV k="provider model" v={m.api_model_name ?? '—'} />
              <KV k="api key" v={m.env_key ? <span className={keys[m.env_key] ? 't-mint' : 't-amber'}>{m.env_key} {keys[m.env_key] ? 'configured' : 'missing'}</span> : '—'} />
              {m.env_key && !keys[m.env_key] && <p className="note">Without this key, calls to this model go to the simulator. <a href="#/app/keys">Add a key</a></p>}
            </>
          )}
          {degraded(m) && (
            <p className="note t-amber">Fault injection is active on this model (kill switch {String(m.chaos.kill_switch)}, +{m.chaos.add_latency_ms} ms, error rate {m.chaos.error_rate}). It was set through the backend's /chaos API.</p>
          )}
        </div>
      </div>

      <div className="md-block">
        <div className="insp-h">Recent requests routed here</div>
        {recent.length === 0 ? (
          <p className="t-dim small">None in the last 100 ledger records.</p>
        ) : (
          <div className="mini-rows">
            {recent.map((r) => (
              <button key={r.id} className="mini-row" onClick={() => go(`app/traces/${r.request_id}`)}>
                <span className="mono t-dim">{time(r.timestamp)}</span>
                <span className="mono">{r.request_id}</span>
                <span className="mono">{ms(r.actual_latency_ms)}</span>
                <span className="mono">{usd(r.actual_cost_usd)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Fleet({ focus }: { focus?: string }) {
  const { models, online } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'local' | 'hosted'>('all');
  const [tier, setTier] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [onlyDegraded, setOnlyDegraded] = useState(false);
  const selected = models.find((m) => m.id === focus) ?? null;

  const filtered = useMemo(
    () =>
      models.filter(
        (m) =>
          (type === 'all' || (type === 'local') === isLocal(m)) &&
          (tier === 'all' || m.tier === tier) &&
          (!onlyDegraded || degraded(m)) &&
          (!q || `${m.id} ${m.name} ${m.family} ${m.api_provider ?? ''}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [models, q, type, tier, onlyDegraded],
  );
  const visibleIds = useMemo(() => new Set(filtered.map((m) => m.id)), [filtered]);
  const select = (id: string) => go(`app/fleet/${id}`);

  return (
    <div className="fleet">
      <Panel
        className="fleet-list"
        title={`${filtered.length} of ${models.length} models`}
        actions={
          <label className="search">
            <Icon name="search" size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models" aria-label="Search models" />
          </label>
        }
      >
        <div className="filters">
          <div className="seg" role="group" aria-label="Endpoint type">
            {(['all', 'local', 'hosted'] as const).map((t) => <button key={t} className={cx(type === t && 'on')} onClick={() => setType(t)}>{t}</button>)}
          </div>
          <div className="seg" role="group" aria-label="Tier">
            {(['all', 'easy', 'medium', 'hard'] as const).map((t) => <button key={t} className={cx(tier === t && 'on')} onClick={() => setTier(t)}>{t}</button>)}
          </div>
          <label className="toggle small">
            <input type="checkbox" checked={onlyDegraded} onChange={(e) => setOnlyDegraded(e.target.checked)} /> degraded only
          </label>
        </div>
        {online === false && <Empty title="Gateway offline" icon="alert">Model data comes from /models.</Empty>}
        <div className="model-rows" role="listbox" aria-label="Models">
          {filtered.map((m) => {
            const st = statusOf(m);
            return (
              <button key={m.id} role="option" aria-selected={m.id === focus} className={cx('model-row', m.id === focus && 'on', isLocal(m) ? 'is-local' : 'is-hosted')} onClick={() => select(m.id)}>
                <span className={cx('st-dot', `tone-${st.tone}`)} />
                <span className="mr-main">
                  <b>{m.name}</b>
                  <small className="mono">{m.id}</small>
                </span>
                <span className="mr-stats mono">
                  <span title="capability">{m.capability_score.toFixed(2)}</span>
                  <span title="context">{ctx(m.context_window)}</span>
                  <span title="calls">{m.telemetry.requests}×</span>
                </span>
              </button>
            );
          })}
          {models.length > 0 && filtered.length === 0 && <Empty title="No models match these filters" icon="search" />}
        </div>
      </Panel>

      <div className="fleet-side">
        <Panel className="fleet-net orbit-panel" title="Fleet topology" sub="Click a model to select it. Drag to turn the orbit, scroll to zoom.">
          <RoutingNetwork variant="orbit" models={models} focusId={focus} onSelect={select} interactive density={0.7} visibleIds={visibleIds} />
        </Panel>
        <Panel className="fleet-detail">
          {selected ? <ModelDetail m={selected} /> : <Empty title="Select a model" icon="fleet">Choose a model from the list or the graph to see its configuration, health and telemetry.</Empty>}
        </Panel>
      </div>
    </div>
  );
}
