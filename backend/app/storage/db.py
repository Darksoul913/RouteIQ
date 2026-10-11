import json
import sqlite3
import hashlib
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from ..config import DB_PATH

GENESIS_HASH = hashlib.sha256(b"GENESIS_ROUTEIQ_00000").hexdigest()

class AuditDatabase:
    """
    SQLite Database with Cryptographic SHA-256 Hash Chaining.
    Ensures immutable, tamper-evident audit logging for live hackathon inspection.
    """
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self._lock = threading.Lock()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        with self._lock, self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    max_latency_ms REAL NOT NULL,
                    max_cost_usd REAL NOT NULL,
                    min_capability REAL NOT NULL,
                    required_context INTEGER,
                    preference TEXT NOT NULL,
                    chosen_model TEXT,
                    actual_latency_ms REAL NOT NULL,
                    actual_cost_usd REAL NOT NULL,
                    actual_capability REAL NOT NULL,
                    actual_context INTEGER NOT NULL,
                    no_valid_model INTEGER NOT NULL,
                    auditor_compliant INTEGER NOT NULL,
                    violations_json TEXT NOT NULL,
                    request_json TEXT NOT NULL,
                    response_json TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    curr_hash TEXT NOT NULL
                )
            """)
            conn.commit()

    def _compute_hash(self, prev_hash: str, req_id: str, ts: str, chosen: Optional[str], lat: float, cost: float, compliant: int) -> str:
        payload = f"{prev_hash}|{req_id}|{ts}|{chosen or 'NONE'}|{lat:.2f}|{cost:.6f}|{compliant}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def insert_audit_record(
        self,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        auditor_verdict: Dict[str, Any]
    ) -> str:
        with self._lock, self._get_connection() as conn:
            # 1. Fetch latest hash
            cursor = conn.cursor()
            cursor.execute("SELECT curr_hash FROM audit_logs ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            prev_hash = row["curr_hash"] if row else GENESIS_HASH

            req_id = response_data.get("request_id")
            ts = response_data.get("timestamp")
            chosen = response_data.get("chosen_model")
            actuals = response_data.get("actual_metrics", {})
            lat = actuals.get("total_latency_ms", 0.0)
            cost = actuals.get("total_cost_usd", 0.0)
            cap = actuals.get("model_capability", 0.0)
            ctx = actuals.get("model_context", 0)
            no_valid = 1 if response_data.get("no_valid_model", False) else 0

            compliant = 1 if auditor_verdict.get("compliant", True) else 0
            violations = json.dumps(auditor_verdict.get("violations", []))

            curr_hash = self._compute_hash(prev_hash, req_id, ts, chosen, lat, cost, compliant)

            cursor.execute("""
                INSERT INTO audit_logs (
                    request_id, timestamp, prompt, max_latency_ms, max_cost_usd,
                    min_capability, required_context, preference, chosen_model,
                    actual_latency_ms, actual_cost_usd, actual_capability, actual_context,
                    no_valid_model, auditor_compliant, violations_json, request_json,
                    response_json, prev_hash, curr_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                req_id, ts, request_data.get("prompt", ""),
                request_data.get("max_latency_ms", 0.0),
                request_data.get("max_cost_usd", 0.0),
                request_data.get("min_capability", 0.0),
                request_data.get("required_context"),
                request_data.get("preference", "lowest_cost"),
                chosen, lat, cost, cap, ctx, no_valid, compliant,
                violations, json.dumps(request_data), json.dumps(response_data),
                prev_hash, curr_hash
            ))
            conn.commit()
            return curr_hash

    def get_audit_records(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, offset)
            )
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def get_violation_counts(self) -> Tuple[int, int]:
        """
        Returns (violation_count, total_count)
        """
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) AS total, SUM(CASE WHEN auditor_compliant = 0 THEN 1 ELSE 0 END) AS violations FROM audit_logs")
            row = cursor.fetchone()
            total = row["total"] or 0
            violations = row["violations"] or 0
            return int(violations), int(total)

    def verify_chain_integrity(self) -> Dict[str, Any]:
        """
        Cryptographic audit verification:
        Walks the entire chain from ID 1 to N, verifying all SHA-256 links.
        """
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM audit_logs ORDER BY id ASC")
            rows = cursor.fetchall()

            if not rows:
                return {
                    "valid": True,
                    "total_records": 0,
                    "broken_at_id": None,
                    "message": "Audit chain empty (Genesis state)"
                }

            expected_prev = GENESIS_HASH
            for row in rows:
                row_id = row["id"]
                prev_hash = row["prev_hash"]
                curr_hash = row["curr_hash"]

                if prev_hash != expected_prev:
                    return {
                        "valid": False,
                        "total_records": len(rows),
                        "broken_at_id": row_id,
                        "message": f"Hash chain broken at record {row_id}: prev_hash mismatch"
                    }

                recomputed = self._compute_hash(
                    prev_hash,
                    row["request_id"],
                    row["timestamp"],
                    row["chosen_model"],
                    row["actual_latency_ms"],
                    row["actual_cost_usd"],
                    row["auditor_compliant"]
                )

                if recomputed != curr_hash:
                    return {
                        "valid": False,
                        "total_records": len(rows),
                        "broken_at_id": row_id,
                        "message": f"Tampering detected at record {row_id}: recomputed hash {recomputed[:12]} != {curr_hash[:12]}"
                    }

                expected_prev = curr_hash

            return {
                "valid": True,
                "total_records": len(rows),
                "broken_at_id": None,
                "message": f"Cryptographic audit chain fully verified ({len(rows)} blocks, 0 tampering detected)"
            }

    def clear(self):
        with self._lock, self._get_connection() as conn:
            conn.execute("DELETE FROM audit_logs")
            try:
                conn.execute("DELETE FROM sqlite_sequence WHERE name = 'audit_logs'")
            except sqlite3.OperationalError:
                pass
            conn.commit()
