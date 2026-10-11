// Shapes mirror backend/app (schemas.py, main.py, storage/*). Keep in sync by hand.

export type Tier = 'easy' | 'medium' | 'hard';
export type Preference = 'lowest_cost' | 'lowest_latency' | 'highest_capability' | 'balanced_pareto';
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface Model {
  id: string;
  name: string;
  family: string;
  tier: Tier;
  context_window: number;
  capability_score: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  base_latency_ms: number;
  endpoint_type: string; // 'local_gguf' | 'cloud_api' ...
  gguf_file?: string;
  api_provider?: string;
  api_model_name?: string;
  env_key?: string;
  circuit_breaker: { state: CircuitState; consecutive_failures: number; total_trips: number; cooldown_remaining_sec: number };
  chaos: { kill_switch: boolean; add_latency_ms: number; error_rate: number };
  telemetry: {
    requests: number;
    errors: number;
    error_rate: number;
    ema_latency_ms: number;
    p95_latency_ms: number;
    total_tokens_in: number;
    total_tokens_out: number;
  };
  gguf_meta: Record<string, unknown>;
}

export interface Health {
  status: string;
  version: string;
  models_registered: number;
  auditor_violations: number;
  total_audited_requests: number;
  chain_valid: boolean;
  genesis_hash: string;
}

export interface RouteRequest {
  prompt: string;
  max_latency_ms: number;
  max_cost_usd: number;
  min_capability: number;
  required_context?: number | null;
  preference: Preference;
  expected_output_tokens: number;
}

export interface Candidate {
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
  circuit_state: CircuitState;
  score: number;
}

export interface FailoverAttempt {
  model_id: string;
  model_name: string;
  error: string;
  time_spent_ms: number;
  remaining_latency_ms: number;
  remaining_cost_usd: number;
}

export interface EstimatorResult {
  tier: Tier;
  raw_tier: Tier;
  confidence: number;
  path: string;
  elevated: boolean;
  elevation_reason: string | null;
  required_capability: number;
  tier_capability: number;
  latency_ms: number;
  heuristic_result?: { tier: Tier; confidence: number };
  secondary_result?: { tier: Tier; confidence: number; path?: string } | null;
  probabilities?: Record<string, number>;
}

export interface ActualMetrics {
  total_latency_ms: number;
  model_execution_ms?: number;
  total_cost_usd: number;
  tokens_in?: number;
  tokens_out?: number;
  model_capability: number;
  model_context: number;
  badge: string;
  status: 'SUCCESS' | 'REFUSED_NO_VALID_MODEL';
  no_valid_model: boolean;
}

export interface CostMatrix {
  tokens_in: number;
  tokens_out: number;
  chosen_model_id: string | null;
  chosen_cost_usd: number;
  baseline_model_id: string;
  baseline_model_name: string;
  baseline_cost_usd: number;
  money_saved_usd: number;
  savings_percentage: number;
}

export interface RouteResponse {
  request_id: string;
  chosen_model: string | null;
  response_text: string;
  no_valid_model: boolean;
  closest_miss_suggestion: string | null;
  estimator: EstimatorResult;
  candidates: Candidate[];
  failover_chain: FailoverAttempt[];
  actual_metrics: ActualMetrics;
  auditor: { compliant: boolean; violations: string[]; audited_at: string; chain_hash?: string };
  timestamp: string;
  cost_matrix?: CostMatrix | null;
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
  request_json: string;
  response_json: string;
  prev_hash: string;
  curr_hash: string;
}

export interface AuditResponse {
  total_records: number;
  violations_count: number;
  chain_valid: boolean;
  chain_status: ChainStatus;
  records: AuditRecord[];
}

export interface ChainStatus {
  valid: boolean;
  total_records: number;
  broken_at_id: number | null;
  message: string;
}

export type KeyStatus = Record<string, boolean>;

export interface StrategySummary {
  total_cost_usd: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  violations: number;
  violation_rate_pct: number;
  success_count: number;
}

export interface BenchmarkResult {
  num_requests: number;
  cost_savings_vs_strongest_pct: number;
  always_strongest: StrategySummary;
  always_cheapest: StrategySummary;
  routeiq: StrategySummary;
}
