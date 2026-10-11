import React from 'react';
import { AuditRecord } from '../types';

interface AuditorLiveFeedProps {
  records: AuditRecord[];
  onVerifyChain: () => void;
  onClearDb: () => void;
}

export const AuditorLiveFeed: React.FC<AuditorLiveFeedProps> = ({
  records,
  onVerifyChain,
  onClearDb,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">SHA-256 Hash-Chained Audit Ledger</h2>
          <p className="text-xs text-slate-400">
            Every request logged with immutable cryptographic chaining. Altering past entries breaks the hash chain.
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onVerifyChain}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-xs transition"
          >
            🛡️ Verify Chain
          </button>
          <button
            onClick={onClearDb}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
          >
            Clear Logs
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="p-3">Req ID</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Model</th>
                <th className="p-3 text-right">Latency</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-center">Compliance</th>
                <th className="p-3 font-mono">Current SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Audit database empty. Run requests to generate tamper-evident logs.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-850/60 transition">
                    <td className="p-3 text-indigo-400 font-bold">{r.request_id}</td>
                    <td className="p-3 text-slate-400">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 text-slate-200">
                      {r.chosen_model || <span className="text-rose-400">REFUSED</span>}
                    </td>
                    <td className="p-3 text-right text-slate-300">
                      {r.actual_latency_ms.toFixed(1)}ms
                    </td>
                    <td className="p-3 text-right text-slate-300">
                      ${r.actual_cost_usd.toFixed(5)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.auditor_compliant
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {r.auditor_compliant ? 'COMPLIANT' : 'BREACH'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 truncate max-w-[140px] font-mono">
                      {r.curr_hash}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
