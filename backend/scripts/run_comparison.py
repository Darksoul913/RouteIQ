import json
import time
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.main import run_workload_comparison

def main():
    print("=" * 65)
    print("RouteIQ Workload Benchmark: RouteIQ vs Baselines")
    print("=" * 65)

    t0 = time.perf_counter()
    res = run_workload_comparison(num_requests=30)
    elapsed = (time.perf_counter() - t0) * 1000.0

    print(f"\nCompleted {res['num_requests']} benchmark tasks in {elapsed:.1f}ms")
    print(f"\nCOST SAVINGS VS ALWAYS STRONGEST: {res['cost_savings_vs_strongest_pct']}%")
    print("-" * 65)
    print(f"{'Strategy':<20} {'Cost ($)':<12} {'Avg Lat (ms)':<14} {'p95 Lat (ms)':<14} {'Violations':<10}")
    print("-" * 65)

    s = res["always_strongest"]
    print(f"{'Always Strongest':<20} ${s['total_cost_usd']:<11.6f} {s['avg_latency_ms']:<14.1f} {s['p95_latency_ms']:<14.1f} {s['violations']:<10}")

    c = res["always_cheapest"]
    print(f"{'Always Cheapest':<20} ${c['total_cost_usd']:<11.6f} {c['avg_latency_ms']:<14.1f} {c['p95_latency_ms']:<14.1f} {c['violations']:<10}")

    r = res["routeiq"]
    print(f"{'RouteIQ (Our Gateway)':<20} ${r['total_cost_usd']:<11.6f} {r['avg_latency_ms']:<14.1f} {r['p95_latency_ms']:<14.1f} {r['violations']:<10}")
    print("=" * 65)

if __name__ == "__main__":
    main()
