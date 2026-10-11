import type { Preference } from '../types';

// Same four samples and constraint sets as the previous dashboard.
export interface Preset {
  key: string;
  label: string;
  hint: string;
  prompt: string;
  max_latency_ms: number;
  max_cost_usd: number;
  min_capability: number;
  preference: Preference;
}

export const PRESETS: Preset[] = [
  { key: 'frugal', label: 'Frugal', hint: 'lowest cost · $0.002 cap', prompt: 'What is the capital of France?', max_latency_ms: 2000, max_cost_usd: 0.002, min_capability: 0, preference: 'lowest_cost' },
  { key: 'fast', label: 'Speed-critical', hint: '350 ms latency SLO', prompt: 'What is the speed of light in vacuum in m/s?', max_latency_ms: 350, max_cost_usd: 0.02, min_capability: 0, preference: 'lowest_latency' },
  { key: 'code', label: 'Code', hint: 'capability ≥ 0.70 · balanced', prompt: 'Write a Python function to reverse a linked list with O(1) space.', max_latency_ms: 2500, max_cost_usd: 0.025, min_capability: 0.7, preference: 'balanced_pareto' },
  { key: 'reason', label: 'Deep reasoning', hint: 'capability ≥ 0.85', prompt: 'Derive the step-by-step mathematical proof of Bellman optimality equation in Markov Decision Processes.', max_latency_ms: 3500, max_cost_usd: 0.05, min_capability: 0.85, preference: 'highest_capability' },
];
