import { useState } from 'react';
import { api } from '../api';
import { Badge, Panel } from '../components/ui';
import { useStore } from '../store';

// The keys POST /keys accepts (ANTHROPIC_API_KEY is read-only status on the backend).
const KEYS = [
  { env: 'GROQ_API_KEY', label: 'Groq', model: 'Llama 3.3 70B', ph: 'gsk_…', url: 'https://console.groq.com/keys' },
  { env: 'GEMINI_API_KEY', label: 'Google Gemini', model: 'Gemini 1.5 Flash', ph: 'AIza…', url: 'https://aistudio.google.com/app/apikey' },
  { env: 'OPENROUTER_API_KEY', label: 'OpenRouter', model: 'Llama 3.2 3B', ph: 'sk-or-v1-…', url: 'https://openrouter.ai/keys' },
  { env: 'OPENAI_API_KEY', label: 'OpenAI', model: 'GPT-4o mini', ph: 'sk-proj-…', url: 'https://platform.openai.com/api-keys' },
  { env: 'DEEPSEEK_API_KEY', label: 'DeepSeek', model: 'DeepSeek V3', ph: 'sk-…', url: 'https://platform.deepseek.com/api_keys' },
];

export default function Keys() {
  const { keys, setKeys } = useStore();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const payload = Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    if (!Object.keys(payload).length) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.saveKeys(payload);
      setKeys({ ...keys, ...res.keys });
      setVals({});
      setMsg({ ok: true, text: `Saved ${Object.keys(payload).length} key(s). The server confirmed the status below.` });
    } catch (e) {
      setMsg({ ok: false, text: `Not saved: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="keys">
      <Panel title="Hosted model keys" sub="Without a key, hosted models fall back to the simulator, and their responses are labelled [SIMULATED].">
        <div className="callout tone-amber small">
          The gateway applies keys to its whole process and writes them in plain text to <code>.env</code> on the server. Use this only on a gateway you control. Keys are never sent back to the browser. You only see whether each one is set.
        </div>
        <div className="key-rows">
          {KEYS.map((k) => (
            <label key={k.env} className="key-row">
              <span className="key-meta">
                <b>{k.label}</b>
                <small className="mono t-dim">{k.env} · {k.model}</small>
              </span>
              <input type="password" autoComplete="off" placeholder={keys[k.env] ? 'configured · enter to replace' : k.ph} value={vals[k.env] ?? ''} onChange={(e) => setVals((s) => ({ ...s, [k.env]: e.target.value }))} />
              <span className="key-st">{keys[k.env] ? <Badge tone="mint" dot>configured</Badge> : <Badge tone="muted">not set</Badge>}</span>
              <a className="link small" href={k.url} target="_blank" rel="noreferrer">get key ↗</a>
            </label>
          ))}
        </div>
        <div className="row gap-m">
          <button className="btn primary" onClick={save} disabled={busy || !Object.values(vals).some((v) => v.trim())}>{busy ? 'Saving…' : 'Save & apply'}</button>
          {msg && <span className={msg.ok ? 't-mint small' : 't-coral small'}>{msg.text}</span>}
        </div>
      </Panel>
    </div>
  );
}
