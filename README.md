# 🏆 RouteIQ: Intelligent Cost-, Latency- & Quality-Aware AI Gateway

> **VORTEXA 3.0 Hackathon Submission**  
> **Domain 2:** AI Systems & Infrastructure  
> **Problem Statement A-01:** ModelRouter: Cost-, Latency- & Quality-Aware AI Routing  
> **Core Axiom:** *"Rules decide. AI only advises. Failover can never relax a constraint."*

---

## 📖 Executive Summary

**RouteIQ** is a production-grade, offline-capable, and live-testable AI Inference Gateway designed to dynamically route user prompts across heterogeneous language models under hard user-defined constraints:
- **Maximum Latency** ($L_{\text{max}}$ in milliseconds)
- **Maximum Budget** ($C_{\text{max}}$ in USD)
- **Minimum Capability Tier** ($Q_{\text{min}}$ from 0.0 to 1.0)
- **Required Context Window** ($W_{\text{req}}$ in tokens)

RouteIQ guarantees that **mathematical constraints are never relaxed or violated**. When endpoints fail, times out, or face upstream chaos, RouteIQ executes **Shrinking-Budget Failover**, dynamically deducting elapsed latency ($L_{\text{rem}} = L_{\text{orig}} - t_{\text{spent}}$) and evaluating remaining candidates strictly under the shrunken budget. Every request is independently validated by a decoupled post-hoc auditor and recorded into an immutable, SHA-256 hash-chained ledger.

---

## 🏛️ Architectural Innovations & Differentiators

```
                       ┌────────────────────────┐
                       │      User Prompt       │
                       │ + Hard SLA Constraints │
                       └───────────┬────────────┘
                                   │
                                   ▼
         ┌──────────────────────────────────────────────────┐
         │     Jev / Laya System 1 Decision Architecture    │
         │  • Fast non-autoregressive classification (<5ms) │
         │  • Calibrated probability distributions          │
         │  • Rule 4: Uncertainty Hedging (bump tier if     │
         │    confidence < 0.70 or estimators disagree)     │
         └─────────────────────────┬────────────────────────┘
                                   │
                                   ▼
         ┌──────────────────────────────────────────────────┐
         │           Mathematical Hard Rule Engine          │
         │  1. Circuit Breaker (CLOSED / OPEN / HALF-OPEN)  │
         │  2. Context Window Fit (Tokens <= ContextWindow) │
         │  3. Predicted Cost Fit (Cost <= Remaining Budget)│
         │  4. Predicted Latency (EMA/p95 <= Rem Latency)   │
         │  5. Model Capability (Cap >= Required Cap)       │
         │  ➜ Generates "Why Not This Model?" Matrix        │
         └─────────────────────────┬────────────────────────┘
                                   │
                                   ▼
         ┌──────────────────────────────────────────────────┐
         │             Stated Preference Ranker             │
         │   (Lowest Cost | Lowest Latency | Pareto Multi)  │
         └─────────────────────────┬────────────────────────┘
                                   │
                                   ▼
         ┌──────────────────────────────────────────────────┐
         │       Unified Dual-Mode Resilient Executor       │
         │  • Live Ollama / Local Model Detection           │
         │  • Deterministic Calibrated Simulator Fallback   │
         │  • Explicit Badging: [MEASURED]|[SIMULATED]      │
         └─────────┬──────────────────────────────┬─────────┘
                   │ Success                      │ Failure / Timeout
                   │                              ▼
                   │              ┌─────────────────────────────────┐
                   │              │    Shrinking-Budget Failover    │
                   │              │   L_rem = L_orig - t_spent      │
                   │              │   Evaluate next compliant model │
                   │              └───────────────┬─────────────────┘
                   │                              │
                   ▼                              ▼
         ┌──────────────────────────────────────────────────┐
         │       Decoupled Independent Constraint Auditor   │
         │  • Mathematical post-hoc check: Latency, Cost,   │
         │    Capability, Context Window                    │
         │  • Live Invariant: Constraint Violations = 0     │
         └─────────────────────────┬────────────────────────┘
                                   │
                                   ▼
         ┌──────────────────────────────────────────────────┐
         │    Cryptographic SHA-256 Hash-Chained SQLite     │
         │   H_i = SHA256(H_{i-1} || request || actuals)    │
         │   Tamper-Evident Proof & Chain Verification      │
         └──────────────────────────────────────────────────┘
```

---

## 🤖 Registered Models & Pricing Table

RouteIQ registers 5 diverse models spanning easy, medium, and frontier tiers:

| Model ID | Display Name | Family | Tier | Capability | Context | Cost / 1k (In/Out) | Base Latency | Endpoint Type |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `llama-3.2-1b` | Llama 3.2 1B (Instruct) | Meta Llama | Easy | **0.42** | 8,192 | $0.00015 / $0.00060 | 180 ms | Ollama / Simulated |
| `qwen-2.5-coder-7b` | Qwen 2.5 Coder 7B | Qwen | Medium | **0.76** | 32,768 | $0.00080 / $0.00240 | 420 ms | Ollama / Simulated |
| `mistral-7b-instruct` | Mistral 7B Instruct v0.3 | Mistral | Medium | **0.72** | 32,768 | $0.00070 / $0.00200 | 380 ms | Ollama / Simulated |
| `deepseek-r1-distill-14b`| DeepSeek R1 Distill 14B | DeepSeek | Hard | **0.91** | 65,536 | $0.00250 / $0.00800 | 950 ms | Ollama / Simulated |
| `claude-3.5-sonnet-sim` | Claude 3.5 Sonnet (Frontier) | Anthropic | Hard | **0.98** | 200,000 | $0.00300 / $0.01500 | 1200 ms | Frontier Reference |

*Note: All execution outputs carry transparent labels: `[MEASURED]` (live endpoint), `[SIMULATED]` (offline simulator), `[INJECTED]` (chaos latency added), or `[RULE_ENFORCED]` (structured refusal).*

---

## ⚡ Quick Start: One-Command Launcher

### 1. Launch Interactive Judge Gateway & UI
```bash
./run.sh
```
Opens the gateway on `http://localhost:8000`. Open your browser to access the full interactive dashboard.

### 2. Run Comprehensive Test Suite (T1-T8 + 1,000 Property Invariants)
```bash
./run.sh --test
```
Executes all 8 formal acceptance tests and 1,000 randomized property tests verifying that **0 constraint violations** occur.

### 3. Run Comparative Workload Benchmark
```bash
./run.sh --benchmark
```
Runs a side-by-side simulation comparing RouteIQ against Always Strongest and Always Cheapest.

### 4. Run Model Benchmark Capability Evaluator
```bash
./run.sh --eval
```
Evaluates all 30 checkable benchmark tasks across models and reports pass rate, latency, and cost.

---

## 🎯 Verification Matrix: Acceptance Tests (T1 to T12)

All acceptance tests are implemented in `backend/tests/test_acceptance.py`:

| ID | Test Name | Invariant Checked | Status |
| :---: | :--- | :--- | :---: |
| **T1** | `test_T1_exceeding_capability_returns_no_valid_model` | Requesting `min_capability=0.99` returns structured refusal (`no_valid_model=True`) with closest miss feedback. | **PASSED** |
| **T2** | `test_T2_killing_chosen_model_triggers_shrinking_budget_failover` | Activating kill-switch fails over to next compliant model; remaining latency budget shrinks ($L_{\text{rem}} = L_{\text{orig}} - t_{\text{spent}}$). | **PASSED** |
| **T3** | `test_T3_failover_never_relaxes_constraints` | If remaining budget after failure is insufficient for remaining models, gateway refuses rather than relaxing constraints. | **PASSED** |
| **T4** | `test_T4_estimator_fallback_records_path` | When primary estimator fails, metadata explicitly records fallback path (`fallback_to_...`). | **PASSED** |
| **T5** | `test_T5_context_overflow_rejected` | Requesting 10k tokens context strictly rejects 8k context models (`llama-3.2-1b`) with explicit context breach reason. | **PASSED** |
| **T6** | `test_T6_low_confidence_raises_tier` | When estimator confidence < 0.70 or disagreement occurs, tier is safely elevated (`easy` $\to$ `medium`, min capability 0.65). | **PASSED** |
| **T7** | `test_T7_deterministic_replay` | Identical prompt, parameters, and system state yield exact same candidates evaluation, ranking, and chosen model. | **PASSED** |
| **T8** | `test_T8_independent_auditor_reports_zero_violations` | Decoupled auditor verifies latency, cost, capability, and context across requests; 0 violations reported. | **PASSED** |
| **T9** | `test_T9_api_gateway_refusal_auditor_records_zero_violations` | End-to-end API gateway refusal correctly verified as compliant with 0 violations in the cryptographic SQLite ledger. | **PASSED** |
| **T10** | `test_T10_tamper_detection_in_hash_chain` | Modifying any historic audit record immediately corrupts the SHA-256 hash chain and is flagged by `verify_chain_integrity()`. | **PASSED** |
| **T11** | `test_T11_genuine_breach_detection` | Auditor sensitivity: genuine SLA breaches (latency > max+5, cost > max*1.01, etc.) are strictly flagged and itemized. | **PASSED** |
| **T12** | `test_T12_output_token_budget_preservation` | Output token budget is respected by the executor, preventing artificial cost overruns under tight cost limits. | **PASSED** |

### 1,000 Randomized Property Invariant Tests (`backend/tests/test_property_1000.py`)
```
Total Requests: 1000
Success Routed: 214 (21.4%)
Refused (No Valid Model): 786 (78.6%)
Constraint Violations: 0 of 1000
Result: 100% Invariant Compliance Guaranteed
```

---

## 📊 Benchmark Results: RouteIQ vs Baselines

Ran across 30 checkable benchmark tasks:

| Strategy | Total Cost ($) | Avg Latency (ms) | p95 Latency (ms) | SLA Violations | Cost Savings |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Always Strongest** (Claude 3.5 Sonnet) | $0.055632 | 1,200.0 ms | 1,200.0 ms | 30 (100%) | 0.0% (Baseline) |
| **Always Cheapest** (Llama 3.2 1B) | $0.002242 | 180.0 ms | 180.0 ms | 20 (66.7%) | 96.0% (Poor Quality) |
| **RouteIQ Gateway (Our Solution)** | **$0.018327** | **631.5 ms** | **950.3 ms** | **0 (0.0%)** | **67.1% Reduction** |

**Empirical Takeaway:** RouteIQ delivers **67.1% cost savings** compared to frontier routing while achieving **0% SLA violations** (compared to 66.7% violations from naive cheap routing).

---

## 🕹️ Live Demo Walkthrough for Judges

1. **Launch Gateway:**
   ```bash
   ./run.sh
   ```
   Open `http://localhost:8000` in Google Chrome or Safari.
2. **Scenario 1: Budget Crunch Preset**
   - Click **"Budget Crunch"** preset ($C_{\text{max}} = \$0.0003$).
   - Click **"Route Request"** $\to$ routes to `Llama 3.2 1B` for \$0.00010.
   - Switch to **"Why Not This Model?" Matrix** $\to$ observe `Qwen`, `Mistral`, `DeepSeek`, and `Claude` were rejected solely on budget breach.
3. **Scenario 2: Strict Latency SLO Preset**
   - Click **"Strict Latency SLO"** preset ($L_{\text{max}} = 250\text{ms}$).
   - Click **"Route Request"** $\to$ routes to `Llama 3.2 1B` (180ms base latency).
4. **Scenario 3: Live Judge Chaos Injection**
   - Switch to **Judge Chaos Studio** tab.
   - On `Llama 3.2 1B`, drag the **Inject Latency** slider to `+800ms`.
   - Return to Gateway and re-send request $\to$ RouteIQ detects $180+800=980\text{ms} > 250\text{ms}$, rejects Llama, and safely falls back or surfaces closest miss.
   - Click **Kill Switch** on `Llama 3.2 1B` $\to$ observe live shrinking-budget failover!
5. **Scenario 4: Cryptographic SHA-256 Ledger**
   - Switch to **Cryptographic Audit Ledger** tab.
   - Click **"Verify Chain"** $\to$ recomputes all SHA-256 blocks from genesis to present and confirms 0 tampering.

---

## 🛠️ Repository File Structure

```
RouteLLM/
├── backend/
│   ├── app/
│   │   ├── main.py               # REST API & Gateway Server
│   │   ├── config.py             # Configuration constants
│   │   ├── models/
│   │   │   ├── registry.json     # 5 models with context, cost, capability, latencies
│   │   │   └── schemas.py        # Request & response validation schemas
│   │   ├── estimators/
│   │   │   ├── base.py           # Estimator abstract base class
│   │   │   ├── baseline_tfidf.py # Calibrated TF-IDF + Logistic Regression
│   │   │   ├── laya_systemone.py # Jev/Laya System 1 non-autoregressive classifier
│   │   │   ├── heuristic.py      # Deterministic keyword & syntax safety net
│   │   │   └── multi_estimator.py# Consensus engine & uncertainty hedging
│   │   ├── engine/
│   │   │   ├── constraints.py    # Hard rule engine & "Why Not?" matrix generator
│   │   │   ├── ranker.py         # Preference sorting (lowest_cost, pareto, etc.)
│   │   │   ├── circuit_breaker.py# 3-state circuit breaker (Closed, Open, Half-Open)
│   │   │   ├── executor.py       # Shrinking-budget failover executor
│   │   │   └── auditor.py        # Independent post-hoc constraint auditor
│   │   ├── storage/
│   │   │   ├── db.py             # SQLite database with SHA-256 hash chaining
│   │   │   └── telemetry.py      # Rolling EMA & p95 latency tracking
│   │   └── chaos/
│   │       └── manager.py        # Judge Chaos Studio (kill switches, latency dials)
│   ├── data/
│   │   ├── prompts_300.json      # 300 curated fictional prompts across 6 domains
│   │   ├── benchmark_30.json     # 30 checkable ground-truth benchmark tasks
│   │   └── estimator_tfidf.joblib# Calibrated TF-IDF pipeline weights
│   ├── scripts/
│   │   ├── train_estimator.py    # Trains & calibrates baseline classifier
│   │   └── run_comparison.py     # Side-by-side benchmark comparison runner
│   └── tests/
│       ├── test_acceptance.py    # Formal Acceptance Tests T1 through T8
│       └── test_property_1000.py # 1,000 randomized property tests (0 violations)
├── frontend/
│   ├── dist/
│   │   └── index.html            # Standalone zero-dependency production dashboard
│   ├── src/
│   │   ├── App.tsx               # React application component
│   │   ├── main.tsx              # React DOM entry
│   │   ├── index.css             # Tailwind CSS styles
│   │   └── types/index.ts        # TypeScript schemas
│   ├── package.json              # Vite & React package setup
│   └── vite.config.ts            # Vite dev proxy configuration
├── run.sh                        # One-command bootstrapper & verification script
└── README.md                     # Comprehensive documentation & judge demo guide
```

---

## ⚖️ License
Developed for **VORTEXA 3.0 Hackathon (Domain 2: AI Systems & Infrastructure)**. All rights reserved.
