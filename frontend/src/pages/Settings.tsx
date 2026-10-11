import { useState } from 'react';
import { KV, Panel } from '../components/ui';
import { useReducedMotion, useStore } from '../store';
import { usd } from '../lib/format';

export default function Settings() {
  const { profile, setProfile, session, resetSession, health } = useStore();
  const reduced = useReducedMotion();
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);
  return (
    <div className="settings">
      <Panel title="Profile" sub="Stored only in this browser">
        <div className="form-grid">
          <label className="field"><span className="field-head"><span>Name</span></span><input value={p.name} onChange={(e) => { setP({ ...p, name: e.target.value }); setSaved(false); }} /></label>
          <label className="field"><span className="field-head"><span>Role</span></span><input value={p.role} onChange={(e) => { setP({ ...p, role: e.target.value }); setSaved(false); }} /></label>
          <label className="field"><span className="field-head"><span>Initials</span></span><input maxLength={3} value={p.avatar} onChange={(e) => { setP({ ...p, avatar: e.target.value.toUpperCase() }); setSaved(false); }} /></label>
        </div>
        <div className="row gap-m">
          <button className="btn primary sm" onClick={() => { setProfile({ name: p.name.trim() || 'Operator', role: p.role.trim(), avatar: p.avatar.trim() || 'OP' }); setSaved(true); }}>Save profile</button>
          {saved && <span className="t-mint small">Saved</span>}
        </div>
      </Panel>
      <Panel title="Session counters" sub="Counted in this browser from /route responses">
        <KV k="queries" v={session.queries} />
        <KV k="spend" v={usd(session.cost, 5)} />
        <KV k="started" v={session.startedAt ? new Date(session.startedAt).toLocaleString() : '—'} />
        <button className="btn ghost sm" onClick={resetSession}>Reset session counters</button>
      </Panel>
      <Panel title="Environment">
        <KV k="gateway version" v={health?.version ?? '—'} />
        <KV k="engine" v="VORTEXA 3.0" />
        <KV k="reduced motion" v={reduced ? 'on (system setting)' : 'off (follows your system setting)'} />
      </Panel>
    </div>
  );
}
