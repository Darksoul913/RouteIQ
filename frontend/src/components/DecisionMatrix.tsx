import React from 'react';
import { RouteResponse } from '../types';

interface DecisionMatrixProps {
  response: RouteResponse | null;
}

export const DecisionMatrix: React.FC<DecisionMatrixProps> = ({ response }) => {
  const candidates = response?.candidates || [];
  const closestMiss = response?.closest_miss_suggestion;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Glass-Box Rejection Matrix: "Why Not This Model?"</h2>
          <p className="text-xs text-slate-400">
            Transparent mathematical verification across every candidate model for the last processed request.
          </p>
        </div>
        {closestMiss && (
          <div className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
            💡 Closest Miss: <span>{closestMiss}</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
            <tr>
              <th className="p-3">Candidate Model</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Circuit</th>
              <th className="p-3 text-center">Context</th>
              <th className="p-3 text-center">Cost Budget</th>
              <th className="p-3 text-center">Latency SLO</th>
              <th className="p-3 text-center">Capability</th>
              <th className="p-3">Explicit Rejection Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No request executed yet. Run a prompt from the Gateway tab to populate candidate audits.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c.model_id} className={c.passed ? 'bg-emerald-950/20' : ''}>
                  <td className="p-3 font-medium text-white">{c.model_name}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {c.passed ? 'PASSED' : 'REJECTED'}
                    </span>
                  </td>
                  <td
                    className={`p-3 text-center font-mono ${
                      c.circuit_state === 'CLOSED' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {c.circuit_state}
                  </td>
                  <td className={`p-3 text-center font-mono ${c.context_fit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {c.context_fit ? '✓' : '✗'}
                  </td>
                  <td className={`p-3 text-center font-mono ${c.cost_fit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${c.predicted_cost_usd.toFixed(5)}
                  </td>
                  <td className={`p-3 text-center font-mono ${c.latency_fit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {c.predicted_latency_ms.toFixed(0)}ms
                  </td>
                  <td
                    className={`p-3 text-center font-mono ${c.capability_fit ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {c.capability_score.toFixed(2)}
                  </td>
                  <td className="p-3 text-slate-300">
                    {c.rejection_reasons.length > 0 ? (
                      <span className="text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded text-[11px] border border-rose-500/20">
                        {c.rejection_reasons.join('; ')}
                      </span>
                    ) : (
                      <span className="text-emerald-400">Compliant</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
