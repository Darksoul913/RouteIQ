export interface ModelInfo {
  id: string;
  name: string;
  family: string;
  tier: "easy" | "medium" | "hard";
  context_window: number;
  capability_score: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  base_latency_ms: number;
  endpoint_type: string;
  ollama_name: string | null;
  simulated: boolean;
  circuit_breaker?: {
    state: string;
    consecutive_failures: number;
    total_trips: number;
    cooldown_remaining_sec: number;
  };
  chaos?: {
    model_id: string;
    add_latency_ms: number;
    kill_switch: boolean;
    error_rate: number;
  };
  telemetry?: {
    requests: number;
    errors: number;
    error_rate: number;
    ema_latency_ms: number;
    p95_latency_ms: number;
    total_tokens_in: number;
    total_tokens_out: number;
  };
}

export interface CandidateAudit {
  model_id: string;
  model_name: string;
  passed: boolean;
  rejection_reasons: string[];
  context_fit: boolean;
  predicted_cost_usd: number;
  cost_fit: boolean;
  predicted_latency_ms: number;
  latency_fit: boolean;
  capability_score: number;
  capability_fit: boolean;
  circuit_state: string;
  score: number;
}

export interface EstimatorResult {
  tier: string;
  raw_tier: string;
  confidence: number;
  path: string;
  elevated: boolean;
  elevation_reason: string | null;
  required_capability: number;
  latency_ms: number;
  probabilities: Record<string, number>;
}

export interface RouteResponse {
  request_id: string;
  chosen_model: string | null;
  response_text: string;
  no_valid_model: boolean;
  closest_miss_suggestion: string | null;
  estimator: EstimatorResult;
  candidates: CandidateAudit[];
  failover_chain: Array<{
    model_id: string;
    model_name: string;
    error: string;
    time_spent_ms: number;
    remaining_latency_ms: number;
  }>;
  actual_metrics: {
    total_latency_ms: number;
    model_execution_ms?: number;
    total_cost_usd: number;
    tokens_in?: number;
    tokens_out?: number;
    model_capability: number;
    model_context: number;
    badge: string;
    status: string;
  };
  auditor: {
    compliant: boolean;
    violations: string[];
    audited_at?: string;
    chain_hash?: string;
  };
  timestamp: string;
}

export interface AuditRecord {
  id: number;
  request_id: string;
  timestamp: string;
  prompt: string;
  max_latency_ms: number;
  max_cost_usd: number;
  min_capability: number;
  required_context: number | null;
  preference: string;
  chosen_model: string | null;
  actual_latency_ms: number;
  actual_cost_usd: number;
  actual_capability: number;
  actual_context: number;
  no_valid_model: number;
  auditor_compliant: number;
  violations_json: string;
  prev_hash: string;
  curr_hash: string;
}

export interface BenchmarkComparison {
  num_requests: number;
  cost_savings_vs_strongest_pct: number;
  always_strongest: {
    total_cost_usd: number;
    avg_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    violations: number;
    violation_rate_pct: number;
  };
  always_cheapest: {
    total_cost_usd: number;
    avg_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    violations: number;
    violation_rate_pct: number;
  };
  routeiq: {
    total_cost_usd: number;
    avg_latency_ms: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    violations: number;
    violation_rate_pct: number;
  };
}
