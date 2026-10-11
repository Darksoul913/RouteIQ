import React from 'react';
import { ModelInfo } from '../types';

interface ModelCardsProps {
  models: ModelInfo[];
}

export const ModelCards: React.FC<ModelCardsProps> = ({ models }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {models.map((m) => {
        const stats = m.telemetry || { requests: 0, errors: 0, ema_latency_ms: 0, p95_latency_ms: 0 };
        const cb = m.circuit_breaker || { state: 'CLOSED' };

        return (
          <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">{m.name}</h4>
                <span className="text-[10px] text-slate-400 font-mono">{m.family} &bull; Tier: {m.tier}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  cb.state === 'CLOSED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {cb.state}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-400">Capability:</span>{' '}
                <span className="font-bold text-violet-400">{m.capability_score.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400">Context:</span>{' '}
                <span className="font-mono text-slate-200">{m.context_window.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400">Base Latency:</span>{' '}
                <span className="font-mono text-indigo-400">{m.base_latency_ms}ms</span>
              </div>
              <div>
                <span className="text-slate-400">Cost/1K In:</span>{' '}
                <span className="font-mono text-emerald-400">${m.input_cost_per_1k.toFixed(5)}</span>
              </div>
              <div>
                <span className="text-slate-400">EMA Latency:</span>{' '}
                <span className="font-mono text-slate-300">{stats.ema_latency_ms}ms</span>
              </div>
              <div>
                <span className="text-slate-400">Total Calls:</span>{' '}
                <span className="font-mono text-slate-300">{stats.requests}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
