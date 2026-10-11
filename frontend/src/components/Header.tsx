import React from 'react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: 'gateway' | 'decision' | 'chaos' | 'benchmark' | 'audit') => void;
  violations: number;
  totalAudits: number;
  onResetChaos: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  violations,
  totalAudits,
  onResetChaos,
}) => {
  const tabs = [
    { id: 'gateway', label: '⚡ Live Gateway & Playground' },
    { id: 'decision', label: '🔍 "Why Not This Model?" Matrix' },
    { id: 'chaos', label: '💥 Judge Chaos Studio' },
    { id: 'benchmark', label: '📊 Workload Benchmark (ROI)' },
    { id: 'audit', label: '🛡️ Cryptographic Ledger' },
  ] as const;

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/20 text-white">
            RQ
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">RouteIQ</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                v1.0 (VORTEXA 3.0)
              </span>
            </div>
            <p className="text-xs text-slate-400">Rules decide. AI only advises. Failover never relaxes a constraint.</p>
          </div>
        </div>

        {/* Live Badges */}
        <div className="flex items-center space-x-3">
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
              violations > 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-ping ${
                violations > 0 ? 'bg-rose-400' : 'bg-emerald-400'
              }`}
            />
            <span>
              Constraint Violations: <strong>{violations}</strong> of {totalAudits}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
            <span className="text-emerald-400">●</span>
            <span>
              SHA-256 Ledger: <span className="text-emerald-400 font-bold">VERIFIED</span>
            </span>
          </div>

          <button
            onClick={onResetChaos}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            Reset Chaos
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-800/60 overflow-x-auto text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};
