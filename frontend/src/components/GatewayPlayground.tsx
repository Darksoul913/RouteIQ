import React, { useState } from 'react';
import { RouteResponse } from '../types';

interface GatewayPlaygroundProps {
  prompt: string;
  setPrompt: (p: string) => void;
  maxLatency: number;
  setMaxLatency: (l: number) => void;
  maxCost: number;
  setMaxCost: (c: number) => void;
  minCapability: number;
  setMinCapability: (q: number) => void;
  requiredContext: number | undefined;
  setRequiredContext: (ctx: number | undefined) => void;
  preference: string;
  setPreference: (pref: string) => void;
  loading: boolean;
  response: RouteResponse | null;
  onRoute: () => void;
  onApplyPreset: (name: 'budget' | 'latency' | 'code' | 'outage') => void;
}

const samplePrompts = [
  'What is the capital of France and what is its population?',
  'Write a Python function to compute the Levenshtein distance between two strings.',
  'Solve step by step: A train travels at 60 mph. How long does it take to travel 180 miles?',
  'Derive the Black-Scholes partial differential equation using the risk-neutral portfolio approach.',
  'Summarize the executive memo in 3 bullet points highlighting breaking architectural changes.',
];

export const GatewayPlayground: React.FC<GatewayPlaygroundProps> = ({
  prompt,
  setPrompt,
  maxLatency,
  setMaxLatency,
  maxCost,
  setMaxCost,
  minCapability,
  setMinCapability,
  requiredContext,
  setRequiredContext,
  preference,
  setPreference,
  loading,
  response,
  onRoute,
  onApplyPreset,
}) => {
  const [sampleIdx, setSampleIdx] = useState(0);

  const cyclePrompt = () => {
    const nextIdx = (sampleIdx + 1) % samplePrompts.length;
    setSampleIdx(nextIdx);
    setPrompt(samplePrompts[nextIdx]);
  };

  const getCapTierLabel = (cap: number) => {
    if (cap >= 0.85) return 'Hard (Frontier)';
    if (cap >= 0.65) return 'Medium';
    return 'Easy';
  };

  return (
    <div className="space-y-6">
      {/* Preset Scenarios */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <span className="text-xs uppercase font-bold tracking-wider text-slate-400">⚡ Judge Preset Scenarios:</span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onApplyPreset('budget')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            💰 Budget Crunch (Max $0.0003)
          </button>
          <button
            onClick={() => onApplyPreset('latency')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition"
          >
            ⏱️ Strict Latency SLO (Max 250ms)
          </button>
          <button
            onClick={() => onApplyPreset('code')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition"
          >
            💻 Code Sprint (Cap &ge; 0.75)
          </button>
          <button
            onClick={() => onApplyPreset('outage')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition"
          >
            💥 Outage Failover Test
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Request Form */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-lg">
          <h2 className="font-bold text-base text-white flex items-center justify-between">
            <span>Inference Request Configuration</span>
            <span className="text-xs font-normal text-indigo-400 font-mono">REST /route</span>
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">User Prompt</label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
              <span>~{Math.max(10, prompt.split(/\s+/).length * 2)} tokens</span>
              <button onClick={cyclePrompt} className="text-indigo-400 hover:underline">
                Cycle sample prompt
              </button>
            </div>
          </div>

          {/* Latency Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Max Latency SLO (L<sub>max</sub>)</span>
              <span className="font-mono text-indigo-400 font-bold">{maxLatency} ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="2500"
              step="50"
              value={maxLatency}
              onChange={(e) => setMaxLatency(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* Cost Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Max Cost Budget (C<sub>max</sub>)</span>
              <span className="font-mono text-emerald-400 font-bold">${maxCost.toFixed(5)}</span>
            </div>
            <input
              type="range"
              min="0.0001"
              max="0.02"
              step="0.0001"
              value={maxCost}
              onChange={(e) => setMaxCost(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Capability Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Minimum Capability (Q<sub>min</sub>)</span>
              <span className="font-mono text-violet-400 font-bold">
                {minCapability.toFixed(2)} ({getCapTierLabel(minCapability)})
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={minCapability}
              onChange={(e) => setMinCapability(Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />
          </div>

          {/* Context & Preference Dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Required Context</label>
              <select
                value={requiredContext || ''}
                onChange={(e) => setRequiredContext(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">None (Default)</option>
                <option value="8000">8,000 tokens</option>
                <option value="16000">16,000 tokens</option>
                <option value="32000">32,000 tokens</option>
                <option value="64000">64,000 tokens</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Stated Preference</label>
              <select
                value={preference}
                onChange={(e) => setPreference(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="lowest_cost">Lowest Cost</option>
                <option value="lowest_latency">Lowest Latency</option>
                <option value="highest_capability">Highest Capability</option>
                <option value="balanced_pareto">Balanced (Pareto)</option>
              </select>
            </div>
          </div>

          <button
            onClick={onRoute}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-semibold text-white shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Evaluating Constraints...' : '⚡ Route Request'}</span>
          </button>
        </div>

        {/* Pipeline & Response */}
        <div className="lg:col-span-7 space-y-5">
          {/* Visual Pipeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3">
              Live Decision Pipeline Flow
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">Step 1</div>
                <div className="font-bold text-slate-300">Prompt</div>
                <div className="text-[10px] text-indigo-400 mt-1">
                  {response ? `${response.actual_metrics.tokens_in || 15} tokens` : 'Ready'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">Step 2</div>
                <div className="font-bold text-slate-300">System 1</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {response
                    ? `${response.estimator.tier.toUpperCase()} (${(response.estimator.confidence * 100).toFixed(0)}%)`
                    : '-'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">Step 3</div>
                <div className="font-bold text-slate-300">Hard Filter</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {response
                    ? `${response.candidates.filter((c) => c.passed).length}/${response.candidates.length} pass`
                    : '-'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500">Step 4</div>
                <div className="font-bold text-slate-300">Executor</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {response ? response.chosen_model || 'Refused' : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Failover Alert Banner */}
          {response?.failover_chain && response.failover_chain.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 space-y-2">
              <div className="font-bold flex items-center space-x-1.5">
                <span>⚠️ Shrinking-Budget Failover Activated</span>
              </div>
              <div className="font-mono text-[11px] text-amber-200 whitespace-pre-wrap">
                {response.failover_chain.map(
                  (f) =>
                    `Attempted ${f.model_name}: ${f.error} (${f.time_spent_ms}ms spent, ${f.remaining_latency_ms}ms remaining)`
                ).join('\n')}
              </div>
            </div>
          )}

          {/* Response Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg min-h-[300px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <span
                  className={`px-2.5 py-1 rounded-md font-bold text-sm border ${
                    response?.no_valid_model
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : response?.chosen_model
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}
                >
                  {response?.chosen_model ||
                    (response?.no_valid_model ? 'Refusal: No Model Qualified' : 'Ready for Request')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                  {response?.actual_metrics.badge || '[STANDBY]'}
                </span>
              </div>
              <div className="text-right font-mono text-xs text-slate-400">
                {response ? (
                  <>
                    <span>{response.actual_metrics.total_latency_ms} ms</span> &bull;{' '}
                    <span>${response.actual_metrics.total_cost_usd.toFixed(6)}</span>
                  </>
                ) : (
                  <span>- ms &bull; $-</span>
                )}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap min-h-[140px] leading-relaxed">
              {response
                ? response.response_text +
                  (response.closest_miss_suggestion
                    ? `\n\n💡 Closest Miss: ${response.closest_miss_suggestion}`
                    : '')
                : 'Configure parameters on the left and click "⚡ Route Request" to test the dynamic AI gateway.'}
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">Auditor Status:</span>
                <span
                  className={`font-bold ${
                    response?.auditor?.compliant === false ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {response?.auditor?.compliant === false
                    ? `❌ Violation: ${response.auditor.violations.join(', ')}`
                    : '● 100% Compliant (0 Breaches)'}
                </span>
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                {response?.auditor?.chain_hash
                  ? `SHA-256: ${response.auditor.chain_hash.substring(0, 16)}...`
                  : 'Hash: None'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
