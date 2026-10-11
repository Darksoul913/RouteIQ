import React from 'react';
import { ModelInfo } from '../types';

interface ChaosPanelProps {
  models: ModelInfo[];
  onUpdateChaos: (modelId: string, addLatency: number, errorRate: number, killSwitch: boolean) => void;
  onResetChaos: () => void;
}

export const ChaosPanel: React.FC<ChaosPanelProps> = ({ models, onUpdateChaos, onResetChaos }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Judge Chaos Studio</h2>
          <p className="text-xs text-slate-400">
            Simulate latency spikes, endpoint outages, and probabilistic errors live to test resilient rerouting.
          </p>
        </div>
        <button
          onClick={onResetChaos}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold text-white text-xs transition shadow-lg shadow-rose-600/30"
        >
          Reset All Chaos & Breakers
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {models.map((m) => {
          const ch = m.chaos || { add_latency_ms: 0, kill_switch: false, error_rate: 0 };
          const cb = m.circuit_breaker || { state: 'CLOSED' };

          return (
            <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">{m.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Base: {m.base_latency_ms}ms &bull; Cap: {m.capability_score}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    cb.state === 'CLOSED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  CB: {cb.state}
                </span>
              </div>

              {/* Latency Injection */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Inject Latency:</span>
                  <span className="font-mono text-amber-400 font-bold">+{ch.add_latency_ms}ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={ch.add_latency_ms}
                  onChange={(e) =>
                    onUpdateChaos(m.id, Number(e.target.value), ch.error_rate, ch.kill_switch)
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Error Rate */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Injected Error Rate:</span>
                  <span className="font-mono text-rose-400 font-bold">
                    {(ch.error_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={ch.error_rate}
                  onChange={(e) =>
                    onUpdateChaos(m.id, ch.add_latency_ms, Number(e.target.value), ch.kill_switch)
                  }
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              {/* Kill Switch */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Kill Switch:</span>
                <button
                  onClick={() =>
                    onUpdateChaos(m.id, ch.add_latency_ms, ch.error_rate, !ch.kill_switch)
                  }
                  className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
                    ch.kill_switch
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {ch.kill_switch ? '🚨 ACTIVE' : 'DISABLED'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
