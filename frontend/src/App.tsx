import React, { useState, useEffect } from 'react';
import { ModelInfo, RouteResponse, CandidateAudit, AuditRecord, BenchmarkComparison } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'gateway' | 'decision' | 'chaos' | 'benchmark' | 'audit'>('gateway');
  const [prompt, setPrompt] = useState('What is the capital of France and what is its population?');
  const [maxLatency, setMaxLatency] = useState(1000);
  const [maxCost, setMaxCost] = useState(0.005);
  const [minCapability, setMinCapability] = useState(0.35);
  const [requiredContext, setRequiredContext] = useState<number | undefined>(undefined);
  const [preference, setPreference] = useState('lowest_cost');

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RouteResponse | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [violations, setViolations] = useState(0);
  const [totalAudits, setTotalAudits] = useState(0);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setViolations(data.auditor_violations || 0);
      setTotalAudits(data.total_audited_requests || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/models');
      const data = await res.json();
      setModels(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAudit = async () => {
    try {
      const res = await fetch('/audit');
      const data = await res.json();
      setAuditRecords(data.records || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchModels();
  }, []);

  const handleRoute = async () => {
    setLoading(true);
    try {
      const res = await fetch('/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_latency_ms: maxLatency,
          max_cost_usd: maxCost,
          min_capability: minCapability,
          required_context: requiredContext || null,
          preference,
          expected_output_tokens: 150
        })
      });
      const data: RouteResponse = await res.json();
      setResponse(data);
      fetchHealth();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-xl shadow-lg">
              RQ
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white">RouteIQ</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  v1.0 (VORTEXA 3.0)
                </span>
              </div>
              <p className="text-xs text-slate-400">Rules decide. AI only advises.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Violations: {violations} of {totalAudits}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 border-t border-slate-800/60 text-sm">
          {(['gateway', 'decision', 'chaos', 'benchmark', 'audit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'chaos') fetchModels();
                if (tab === 'audit') fetchAudit();
              }}
              className={`px-4 py-2.5 font-medium border-b-2 transition ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'gateway' && '⚡ Live Gateway'}
              {tab === 'decision' && '🔍 "Why Not This Model?"'}
              {tab === 'chaos' && '💥 Judge Chaos Studio'}
              {tab === 'benchmark' && '📊 Workload Benchmark'}
              {tab === 'audit' && '🛡️ Cryptographic Ledger'}
            </button>
          ))}
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'gateway' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="font-bold text-white">Route Request</h2>
              <textarea
                rows={3}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500"
              />
              <div>
                <label className="text-xs text-slate-400">Max Latency: {maxLatency}ms</label>
                <input
                  type="range"
                  min="100"
                  max="2500"
                  step="50"
                  value={maxLatency}
                  onChange={e => setMaxLatency(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Max Cost: ${maxCost.toFixed(5)}</label>
                <input
                  type="range"
                  min="0.0001"
                  max="0.02"
                  step="0.0001"
                  value={maxCost}
                  onChange={e => setMaxCost(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Min Capability: {minCapability.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={minCapability}
                  onChange={e => setMinCapability(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
              <button
                onClick={handleRoute}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow-lg transition"
              >
                {loading ? 'Evaluating...' : 'Route Request'}
              </button>
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="font-bold text-indigo-400">
                  {response?.chosen_model || (response?.no_valid_model ? 'REFUSED (No Valid Model)' : 'Standby')}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {response ? `${response.actual_metrics.total_latency_ms}ms • $${response.actual_metrics.total_cost_usd.toFixed(6)}` : ''}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap min-h-[140px]">
                {response ? response.response_text : 'Configure constraints and run a route test.'}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
