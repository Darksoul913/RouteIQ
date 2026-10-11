import { useState } from 'react';
import Pipeline, { WORKSPACE_STAGES } from '../components/Pipeline';
import { CandidateDetail, DecisionInspector, ResponseView } from '../components/Inspector';
import RoutingNetwork from '../components/RoutingNetwork';
import { Badge, Drawer, Empty, Panel } from '../components/ui';
import { useStore, type Run } from '../store';
import { PRESETS } from '../lib/presets';
import { PREFERENCES, cx, ms, time, usd } from '../lib/format';
import { badgeTone } from '../lib/decision';
import type { Candidate, Preference, RouteRequest } from '../types';

const DEFAULTS: Omit<RouteRequest, 'prompt'> = {
  max_latency_ms: 2000,
  max_cost_usd: 0.02,
  min_capability: 0,
  required_context: null,
  preference: 'lowest_cost',
  expected_output_tokens: 180,
};

function Field({ label, value, children, hint }: { label: string; value?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-head">
        <span>{label}</span>
        {value && <b className="mono">{value}</b>}
      </span>
      {children}
      {hint && <small className="t-dim">{hint}</small>}
    </label>
  );
}

export default function LiveRouting() {
  const { runRoute, inFlight, history, models, online } = useStore();
  const [prompt, setPrompt] = useState('');
  const [p, setP] = useState(DEFAULTS);
  const [current, setCurrent] = useState<Run | null>(history[0] ?? null);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Candidate | null>(null);
  const [useCtx, setUseCtx] = useState(false);

  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setP((s) => ({ ...s, [k]: v }));
  const applyPreset = (key: string) => {
    const x = PRESETS.find((y) => y.key === key)!;
    setPrompt(x.prompt);
    setP((s) => ({ ...s, max_latency_ms: x.max_latency_ms, max_cost_usd: x.max_cost_usd, min_capability: x.min_capability, preference: x.preference }));
  };

  const submit = async () => {
    if (!prompt.trim() || inFlight) return;
    const req: RouteRequest = { ...p, prompt: prompt.trim(), required_context: useCtx ? p.required_context : null };
    setError(null);
    setCurrent(null);
    try {
      const res = await runRoute(req);
      setCurrent({ req, res });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const estTokens = prompt.trim() ? Math.max(10, prompt.trim().split(/\s+/).length * 2) : 0;

  return (
    <div className="live">
      <Panel className="live-form" title="Request" sub="These fields map directly onto POST /route">
        <div className="chips compact" aria-label="Presets">
          {PRESETS.map((x) => (
            <button key={x.key} className="chip" onClick={() => applyPreset(x.key)} title={x.prompt}>
              <b>{x.label}</b>
            </button>
          ))}
        </div>
        <Field label="Prompt" value={`~${estTokens} tok`}>
          <textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask anything. Enter to route, Shift+Enter for a new line."
          />
        </Field>
        <Field label="Max latency" value={ms(p.max_latency_ms)} hint="hard limit · end-to-end">
          <input type="range" min={100} max={5000} step={50} value={p.max_latency_ms} onChange={(e) => set('max_latency_ms', +e.target.value)} />
        </Field>
        <Field label="Max cost" value={usd(p.max_cost_usd, 4)} hint="hard limit · per request">
          <input type="range" min={0.0001} max={0.05} step={0.0001} value={p.max_cost_usd} onChange={(e) => set('max_cost_usd', +e.target.value)} />
        </Field>
        <Field label="Min capability" value={p.min_capability.toFixed(2)} hint="Laya System 1 may raise this based on its tier estimate">
          <input type="range" min={0} max={1} step={0.05} value={p.min_capability} onChange={(e) => set('min_capability', +e.target.value)} />
        </Field>
        <div className="field">
          <label className="toggle">
            <input type="checkbox" checked={useCtx} onChange={(e) => setUseCtx(e.target.checked)} /> Require a context window
          </label>
          {useCtx && (
            <input type="number" min={1} step={1024} value={p.required_context ?? 8192} onChange={(e) => set('required_context', Math.max(1, +e.target.value || 1))} aria-label="Required context tokens" />
          )}
        </div>
        <Field label="Expected output tokens" value={String(p.expected_output_tokens)}>
          <input type="range" min={16} max={1024} step={16} value={p.expected_output_tokens} onChange={(e) => set('expected_output_tokens', +e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-head"><span>Optimization preference</span></span>
          <div className="seg wide" role="radiogroup" aria-label="Preference">
            {PREFERENCES.map((x) => (
              <button key={x.value} role="radio" aria-checked={p.preference === x.value} className={cx(p.preference === x.value && 'on')} onClick={() => set('preference', x.value as Preference)}>
                {x.label}
              </button>
            ))}
          </div>
          <small className="t-dim">A preference only changes the order of models that already pass every constraint.</small>
        </div>
        <button className="btn primary block" onClick={submit} disabled={inFlight || !prompt.trim() || online === false}>
          {inFlight ? 'Routing…' : 'Route request'}
        </button>
        {online === false && <p className="t-coral small">The gateway isn't reachable.</p>}
      </Panel>

      <div className="live-center">
        <Panel className="live-pipe" title="Decision pipeline" sub={current ? <>Replaying <span className="mono">{current.res.request_id}</span>. Click a candidate to inspect it.</> : 'Route a request to see each stage'}>
          <Pipeline stages={WORKSPACE_STAGES} result={current?.res ?? null} pref={current?.req.preference ?? p.preference} running={inFlight} error={error} onInspect={setInspect} />
        </Panel>
        <Panel className="live-net orbit-panel" title="Route on the fleet" sub="The last request replays here: teal arc to the chosen model, red × on rejected ones.">
          <RoutingNetwork variant="orbit" models={models} density={0.8} focusId={current?.res.chosen_model} />
        </Panel>
        <Panel
          className="live-resp"
          title="Response"
          actions={current && <Badge tone={badgeTone(current.res.actual_metrics.badge)}>{current.res.actual_metrics.badge}</Badge>}
        >
          {current ? (
            current.res.no_valid_model ? (
              <div className="callout tone-amber">
                <b>Refused.</b> No model satisfies every hard constraint under the available budget.
                {current.res.closest_miss_suggestion && <div className="mono small">{current.res.closest_miss_suggestion}</div>}
              </div>
            ) : (
              <ResponseView res={current.res} />
            )
          ) : (
            <Empty title="No response yet" icon="route" />
          )}
        </Panel>
        {history.length > 0 && (
          <Panel title="This session" sub="Click to replay">
            <div className="mini-rows">
              {history.map((h) => (
                <button key={h.res.request_id} className={cx('mini-row', current?.res.request_id === h.res.request_id && 'on')} onClick={() => { setCurrent(h); setError(null); }}>
                  <span className="mono t-dim">{time(h.res.timestamp)}</span>
                  <span className="ellipsis">{h.req.prompt}</span>
                  <span className="mono">{h.res.chosen_model ?? 'refused'}</span>
                  <span className="mono">{ms(h.res.actual_metrics.total_latency_ms)}</span>
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <Panel className="live-insp" title="Decision inspector">
        {current ? <DecisionInspector req={current.req} res={current.res} onInspect={setInspect} /> : <Empty title="Nothing to inspect yet" icon="audit">After you route a request, this panel explains the choice: the estimate, which constraints passed, the fallbacks, and the audit result.</Empty>}
      </Panel>

      <Drawer open={!!inspect && !!current} onClose={() => setInspect(null)} title={inspect ? inspect.model_name : ''}>
        {inspect && current && <CandidateDetail c={inspect} res={current.res} req={current.req} />}
      </Drawer>
    </div>
  );
}
