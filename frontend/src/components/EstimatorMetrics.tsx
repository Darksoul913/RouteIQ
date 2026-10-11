import React from 'react';
import { RouteResponse } from '../types';

interface EstimatorMetricsProps {
  response: RouteResponse | null;
}

export const EstimatorMetrics: React.FC<EstimatorMetricsProps> = ({ response }) => {
  const est = response?.estimator;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div>
        <h3 className="font-bold text-white text-base">Laya System 1 Complexity Analysis</h3>
        <p className="text-xs text-slate-400">
          Non-autoregressive decision model telemetry, calibrated probabilities, and uncertainty hedging state.
        </p>
      </div>

      {!est ? (
        <div className="p-8 text-center text-slate-500 text-xs font-mono">
          Execute a route request to view System 1 classification telemetry.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
            <span className="text-slate-400">Classified Tier</span>
            <div className="text-lg font-bold text-indigo-400 uppercase">{est.tier}</div>
            <span className="text-[10px] text-slate-500 font-mono">Raw: {est.raw_tier}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
            <span className="text-slate-400">Confidence Score</span>
            <div className="text-lg font-bold text-emerald-400">
              {(est.confidence * 100).toFixed(1)}%
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Threshold: 70.0%
            </span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
            <span className="text-slate-400">Hedging State</span>
            <div
              className={`text-lg font-bold ${
                est.elevated ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {est.elevated ? 'Elevated (Hedged)' : 'Normal'}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {est.elevation_reason || 'Consensus reached'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
