import { ModelInfo, RouteResponse, AuditRecord, BenchmarkComparison } from '../types';

const API_BASE = '';

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async getModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error(`Get models failed: ${res.statusText}`);
    return res.json();
  },

  async route(payload: {
    prompt: string;
    max_latency_ms: number;
    max_cost_usd: number;
    min_capability: number;
    required_context?: number | null;
    preference?: string;
    expected_output_tokens?: number;
  }): Promise<RouteResponse> {
    const res = await fetch(`${API_BASE}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Route failed: ${res.statusText}`);
    }
    return res.json();
  },

  async setChaos(data: {
    model_id: string;
    add_latency_ms?: number;
    kill_switch?: boolean;
    error_rate?: number;
  }) {
    const res = await fetch(`${API_BASE}/chaos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async resetChaos() {
    const res = await fetch(`${API_BASE}/chaos/reset`, { method: 'POST' });
    return res.json();
  },

  async getAudit(limit = 100): Promise<{
    total_records: number;
    violations_count: number;
    chain_valid: boolean;
    records: AuditRecord[];
  }> {
    const res = await fetch(`${API_BASE}/audit`);
    return res.json();
  },

  async verifyChain(): Promise<{ valid: boolean; total_records: number; broken_at_id: number | null; message: string }> {
    const res = await fetch(`${API_BASE}/audit/verify`);
    return res.json();
  },

  async clearAudit() {
    const res = await fetch(`${API_BASE}/audit/clear`, { method: 'POST' });
    return res.json();
  },

  async runBenchmarkComparison(count = 30): Promise<BenchmarkComparison> {
    const res = await fetch(`${API_BASE}/benchmark/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    return res.json();
  },
};
