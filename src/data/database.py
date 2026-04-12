"""Persistent complaint memory using SQLite."""
import json
import logging
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent.parent / "data" / "complaints.db"


def _row_to_dict(row) -> dict:
    return dict(row) if row else {}


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(
        str(DB_PATH),
        check_same_thread=False,
        timeout=30,  # wait up to 30 s if the file is locked
    )
    conn.execute("PRAGMA journal_mode=WAL")   # allow concurrent readers during writes
    conn.execute("PRAGMA busy_timeout=30000") # SQLite-level 30 s busy-wait
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create all tables if they don't exist."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = _get_conn()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS processed_complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id TEXT UNIQUE,
                narrative TEXT,
                company TEXT,
                state TEXT,
                source TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                product TEXT,
                issue TEXT,
                severity TEXT,
                compliance_risk REAL,
                resolution_probability REAL,
                resolution_ci_lower REAL,
                resolution_ci_upper REAL,
                risk_gap REAL,
                assigned_team TEXT,
                priority TEXT,
                overall_confidence REAL,
                quality_flag TEXT,
                human_review_needed BOOLEAN DEFAULT 0,
                auto_processed BOOLEAN DEFAULT 0,
                slack_team_sent BOOLEAN DEFAULT 0,
                slack_alert_sent BOOLEAN DEFAULT 0,
                email_sent BOOLEAN DEFAULT 0,
                processing_time_seconds REAL,
                full_result_json TEXT
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                action_type TEXT,
                description TEXT,
                complaint_id TEXT,
                severity_level TEXT DEFAULT 'info',
                metadata_json TEXT
            );

            CREATE TABLE IF NOT EXISTS detected_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                pattern_type TEXT,
                description TEXT,
                company TEXT,
                product TEXT,
                issue TEXT,
                complaint_count INTEGER,
                time_window_hours INTEGER,
                complaint_ids TEXT,
                resolved BOOLEAN DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS system_state (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_number TEXT UNIQUE NOT NULL,
                complaint_id TEXT,
                status TEXT DEFAULT 'open',
                product TEXT,
                issue TEXT,
                severity TEXT,
                priority TEXT,
                assigned_team TEXT,
                company TEXT,
                state TEXT,
                narrative_preview TEXT,
                resolution_probability REAL,
                risk_gap REAL,
                overall_confidence REAL,
                auto_processed BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME,
                resolution_summary TEXT,
                customer_satisfaction_score INTEGER,
                full_result_json TEXT
            );

            CREATE TABLE IF NOT EXISTS case_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                task_number INTEGER NOT NULL,
                description TEXT NOT NULL,
                task_type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                assigned_to TEXT,
                regulation_reference TEXT,
                due_date DATETIME,
                completed_at DATETIME,
                completed_by TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases(id)
            );

            CREATE TABLE IF NOT EXISTS satisfaction_surveys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                case_number TEXT NOT NULL,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                responded_at DATETIME,
                score INTEGER,
                feedback_text TEXT,
                status TEXT DEFAULT 'sent',
                FOREIGN KEY (case_id) REFERENCES cases(id)
            );

            CREATE TABLE IF NOT EXISTS sent_emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_type TEXT NOT NULL,
                to_address TEXT NOT NULL,
                subject TEXT,
                case_number TEXT,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'sent'
            );

            CREATE TABLE IF NOT EXISTS routing_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                case_number TEXT,
                product TEXT,
                assigned_team TEXT,
                outcome TEXT,
                resolution_time_hours REAL,
                satisfaction_score INTEGER,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Seed default system state
        defaults = [
            ("monitoring_active", "false"),
            ("last_poll_time", ""),
            ("poll_interval_minutes", "30"),
            ("total_processed", "0"),
            ("total_auto_processed", "0"),
            ("total_patterns_detected", "0"),
        ]
        for key, value in defaults:
            conn.execute(
                "INSERT OR IGNORE INTO system_state (key, value) VALUES (?, ?)",
                (key, value),
            )
        conn.commit()
        logger.info("Database initialized at %s", DB_PATH)

        # Apply schema migrations for new columns (idempotent)
        migrations = [
            "ALTER TABLE cases ADD COLUMN predicted_satisfaction_score REAL",
            "ALTER TABLE cases ADD COLUMN preventive_recommendation TEXT",
            "ALTER TABLE cases ADD COLUMN source TEXT",
            "ALTER TABLE detected_patterns ADD COLUMN recommendation TEXT",
        ]
        for sql in migrations:
            try:
                conn.execute(sql)
                conn.commit()
            except Exception:
                pass  # Column already exists
    finally:
        conn.close()


def save_complaint(complaint_data: dict) -> int:
    """Save a processed complaint to the database. Returns row id."""
    conn = _get_conn()
    try:
        cursor = conn.execute(
            """
            INSERT OR REPLACE INTO processed_complaints (
                complaint_id, narrative, company, state, source,
                product, issue, severity, compliance_risk,
                resolution_probability, resolution_ci_lower, resolution_ci_upper,
                risk_gap, assigned_team, priority, overall_confidence, quality_flag,
                human_review_needed, auto_processed, slack_team_sent, slack_alert_sent,
                email_sent, processing_time_seconds, full_result_json
            ) VALUES (
                :complaint_id, :narrative, :company, :state, :source,
                :product, :issue, :severity, :compliance_risk,
                :resolution_probability, :resolution_ci_lower, :resolution_ci_upper,
                :risk_gap, :assigned_team, :priority, :overall_confidence, :quality_flag,
                :human_review_needed, :auto_processed, :slack_team_sent, :slack_alert_sent,
                :email_sent, :processing_time_seconds, :full_result_json
            )
            """,
            complaint_data,
        )
        conn.commit()
        # Update total_processed counter
        conn.execute(
            "UPDATE system_state SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP WHERE key = 'total_processed'"
        )
        if complaint_data.get("auto_processed"):
            conn.execute(
                "UPDATE system_state SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP WHERE key = 'total_auto_processed'"
            )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def save_activity(
    action_type: str,
    description: str,
    complaint_id: Optional[str] = None,
    severity: str = "info",
    metadata: Optional[dict] = None,
) -> int:
    """Log a system activity. Returns row id."""
    conn = _get_conn()
    try:
        cursor = conn.execute(
            """
            INSERT INTO activity_log (action_type, description, complaint_id, severity_level, metadata_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                action_type,
                description,
                complaint_id,
                severity,
                json.dumps(metadata) if metadata else None,
            ),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def save_pattern(pattern_data: dict) -> int:
    """Save a detected pattern. Returns row id."""
    conn = _get_conn()
    try:
        cursor = conn.execute(
            """
            INSERT INTO detected_patterns (
                pattern_type, description, company, product, issue,
                complaint_count, time_window_hours, complaint_ids
            ) VALUES (
                :pattern_type, :description, :company, :product, :issue,
                :complaint_count, :time_window_hours, :complaint_ids
            )
            """,
            pattern_data,
        )
        conn.commit()
        conn.execute(
            "UPDATE system_state SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP WHERE key = 'total_patterns_detected'"
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_existing_cluster(company: str, product: str) -> Optional[dict]:
    """Return the most recent unresolved complaint_cluster for company+product, or None."""
    conn = _get_conn()
    try:
        row = conn.execute(
            """
            SELECT * FROM detected_patterns
            WHERE pattern_type = 'complaint_cluster'
              AND company = ? AND product = ? AND resolved = 0
            ORDER BY detected_at DESC LIMIT 1
            """,
            (company, product),
        ).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def get_processed_complaint_ids() -> set:
    """Get all CFPB complaint IDs we've already processed (for deduplication)."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT complaint_id FROM processed_complaints WHERE complaint_id IS NOT NULL"
        ).fetchall()
        return {row[0] for row in rows if row[0]}
    finally:
        conn.close()


def update_pattern_recommendation(pattern_id: int, recommendation: str) -> None:
    """Store a generated preventive recommendation for a complaint cluster."""
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE detected_patterns SET recommendation = ? WHERE id = ?",
            (recommendation, pattern_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_pattern_count(pattern_id: int, new_count: int, complaint_ids: str) -> None:
    """Update the complaint_count and complaint_ids of an existing pattern."""
    conn = _get_conn()
    try:
        conn.execute(
            """
            UPDATE detected_patterns
            SET complaint_count = ?, complaint_ids = ?,
                description = (
                    SELECT REPLACE(description, CAST(complaint_count AS TEXT) || ' complaints',
                                   CAST(? AS TEXT) || ' complaints')
                    FROM detected_patterns WHERE id = ?
                )
            WHERE id = ?
            """,
            (new_count, complaint_ids, new_count, pattern_id, pattern_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_recent_complaints(hours: int = 24, limit: int = 50) -> list[dict]:
    """Get recently processed complaints."""
    conn = _get_conn()
    try:
        since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        rows = conn.execute(
            """
            SELECT * FROM processed_complaints
            WHERE created_at >= ?
            ORDER BY created_at DESC LIMIT ?
            """,
            (since, limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_recent_activity(hours: int = 24, limit: int = 100) -> list[dict]:
    """Get recent activity log entries."""
    conn = _get_conn()
    try:
        since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        rows = conn.execute(
            """
            SELECT * FROM activity_log
            WHERE timestamp >= ?
            ORDER BY timestamp DESC LIMIT ?
            """,
            (since, limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_all_activity(limit: int = 200, offset: int = 0) -> list[dict]:
    """Get all activity log entries paginated."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_active_patterns() -> list[dict]:
    """Get all unresolved patterns."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM detected_patterns WHERE resolved = 0 ORDER BY detected_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def resolve_pattern(pattern_id: int) -> None:
    """Mark a pattern as resolved."""
    conn = _get_conn()
    try:
        conn.execute(
            "UPDATE detected_patterns SET resolved = 1 WHERE id = ?", (pattern_id,)
        )
        conn.commit()
    finally:
        conn.close()


def get_complaints_by_company(company: str, days: int = 7) -> list[dict]:
    """Get complaints for a specific company within the time window."""
    conn = _get_conn()
    try:
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        rows = conn.execute(
            """
            SELECT * FROM processed_complaints
            WHERE company = ? AND created_at >= ?
            ORDER BY created_at DESC
            """,
            (company, since),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_complaints_by_product(product: str, days: int = 7) -> list[dict]:
    """Get complaints for a specific product within the time window."""
    conn = _get_conn()
    try:
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()
        rows = conn.execute(
            """
            SELECT * FROM processed_complaints
            WHERE product = ? AND created_at >= ?
            ORDER BY created_at DESC
            """,
            (product, since),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_stats(days: int = 7) -> dict:
    """Return aggregate processing statistics."""
    conn = _get_conn()
    try:
        since = (datetime.utcnow() - timedelta(days=days)).isoformat()

        total = conn.execute(
            "SELECT COUNT(*) FROM processed_complaints WHERE created_at >= ?", (since,)
        ).fetchone()[0]

        auto = conn.execute(
            "SELECT COUNT(*) FROM processed_complaints WHERE created_at >= ? AND auto_processed = 1",
            (since,),
        ).fetchone()[0]

        held = conn.execute(
            "SELECT COUNT(*) FROM processed_complaints WHERE created_at >= ? AND human_review_needed = 1",
            (since,),
        ).fetchone()[0]

        escalated = conn.execute(
            "SELECT COUNT(*) FROM processed_complaints WHERE created_at >= ? AND quality_flag = 'fail'",
            (since,),
        ).fetchone()[0]

        by_severity = {}
        for row in conn.execute(
            "SELECT severity, COUNT(*) as cnt FROM processed_complaints WHERE created_at >= ? GROUP BY severity",
            (since,),
        ).fetchall():
            by_severity[row["severity"]] = row["cnt"]

        by_team = {}
        for row in conn.execute(
            "SELECT assigned_team, COUNT(*) as cnt FROM processed_complaints WHERE created_at >= ? GROUP BY assigned_team",
            (since,),
        ).fetchall():
            by_team[row["assigned_team"]] = row["cnt"]

        by_product = {}
        for row in conn.execute(
            "SELECT product, COUNT(*) as cnt FROM processed_complaints WHERE created_at >= ? GROUP BY product",
            (since,),
        ).fetchall():
            by_product[row["product"]] = row["cnt"]

        avg_row = conn.execute(
            """SELECT AVG(overall_confidence) as avg_conf, AVG(risk_gap) as avg_risk,
               AVG(processing_time_seconds) as avg_time
               FROM processed_complaints WHERE created_at >= ?""",
            (since,),
        ).fetchone()

        slack_alerts = conn.execute(
            "SELECT COUNT(*) FROM processed_complaints WHERE created_at >= ? AND slack_alert_sent = 1",
            (since,),
        ).fetchone()[0]

        emails = conn.execute(
            "SELECT COUNT(*) FROM processed_complaints WHERE created_at >= ? AND email_sent = 1",
            (since,),
        ).fetchone()[0]

        patterns = conn.execute(
            "SELECT COUNT(*) FROM detected_patterns WHERE detected_at >= ?", (since,)
        ).fetchone()[0]

        return {
            "period_days": days,
            "total_processed": total,
            "auto_processed": auto,
            "held_for_review": held,
            "escalated": escalated,
            "by_severity": by_severity,
            "by_team": by_team,
            "by_product": by_product,
            "avg_confidence": round(avg_row["avg_conf"] or 0, 3),
            "avg_risk_gap": round(avg_row["avg_risk"] or 0, 3),
            "avg_processing_time": round(avg_row["avg_time"] or 0, 1),
            "patterns_detected": patterns,
            "slack_alerts_sent": slack_alerts,
            "emails_sent": emails,
        }
    finally:
        conn.close()


def get_complaints_by_day(days: int = 7) -> list[dict]:
    """Return complaint count grouped by calendar day for the last N days."""
    conn = _get_conn()
    try:
        since = (datetime.utcnow() - timedelta(days=days)).date().isoformat()
        rows = conn.execute(
            """
            SELECT DATE(created_at) as day, COUNT(*) as count
            FROM processed_complaints
            WHERE DATE(created_at) >= ?
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            """,
            (since,),
        ).fetchall()
        counts_by_day = {r["day"]: r["count"] for r in rows}
        # Fill in zeros for missing days
        result = []
        for i in range(days):
            d = (datetime.utcnow() - timedelta(days=days - 1 - i)).date().isoformat()
            result.append({"date": d, "count": counts_by_day.get(d, 0)})
        return result
    finally:
        conn.close()


def get_system_state() -> dict:
    """Return all system state key-value pairs as a dict."""
    conn = _get_conn()
    try:
        rows = conn.execute("SELECT key, value FROM system_state").fetchall()
        return {r["key"]: r["value"] for r in rows}
    finally:
        conn.close()


def set_system_state(key: str, value: str) -> None:
    """Set a system state value."""
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────
# Case management functions
# ─────────────────────────────────────────────────────────────

def generate_case_number() -> str:
    """Generate unique case number like CIS-2026-0001."""
    conn = _get_conn()
    try:
        year = datetime.utcnow().year
        row = conn.execute(
            "SELECT COUNT(*) FROM cases WHERE case_number LIKE ?",
            (f"CIS-{year}-%",),
        ).fetchone()
        n = (row[0] if row else 0) + 1
        return f"CIS-{year}-{n:04d}"
    finally:
        conn.close()


def create_case(complaint_data: dict, pipeline_result: dict) -> dict:
    """Create a new case from a processed complaint. Returns case dict with id and case_number."""
    case_number = generate_case_number()
    cls = pipeline_result.get("classification", {})
    risk = pipeline_result.get("risk_analysis", {})
    routing = pipeline_result.get("routing", {})
    quality = pipeline_result.get("quality_check", {})
    resolution = pipeline_result.get("resolution", {})
    complaint = pipeline_result.get("complaint", {})

    narrative = complaint_data.get("narrative", "") or complaint.get("narrative", "")
    # Extract predicted satisfaction score if available
    predicted_sat = pipeline_result.get("predicted_satisfaction")
    sat_score = predicted_sat.get("predicted_score") if isinstance(predicted_sat, dict) else None
    # Extract single preventive recommendation from resolution
    prev_rec = resolution.get("preventive_recommendation") if resolution else None

    conn = _get_conn()
    try:
        cursor = conn.execute(
            """
            INSERT INTO cases (
                case_number, complaint_id, status, product, issue, severity, priority,
                assigned_team, company, state, narrative_preview,
                resolution_probability, risk_gap, overall_confidence,
                auto_processed, full_result_json,
                predicted_satisfaction_score, preventive_recommendation, source
            ) VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                case_number,
                complaint_data.get("complaint_id", ""),
                cls.get("predicted_product", ""),
                cls.get("predicted_issue", ""),
                cls.get("severity", ""),
                routing.get("priority_level", "P3"),
                routing.get("assigned_team", ""),
                complaint_data.get("company", ""),
                complaint_data.get("state", ""),
                narrative[:200],
                risk.get("resolution_probability", 0.0),
                risk.get("risk_gap", 0.0),
                quality.get("overall_confidence", 0.0),
                1 if complaint_data.get("auto_processed") else 0,
                json.dumps(pipeline_result),
                sat_score,
                prev_rec,
                complaint_data.get("source", "manual"),
            ),
        )
        conn.commit()
        case_id = cursor.lastrowid
        return {"id": case_id, "case_number": case_number}
    finally:
        conn.close()


def create_case_tasks(case_id: int, tasks: list[dict]) -> list[int]:
    """Bulk create tasks for a case. Returns list of task IDs."""
    conn = _get_conn()
    try:
        ids = []
        for i, task in enumerate(tasks, start=1):
            cursor = conn.execute(
                """
                INSERT INTO case_tasks (
                    case_id, task_number, description, task_type, status,
                    assigned_to, regulation_reference, due_date
                ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
                """,
                (
                    case_id,
                    i,
                    task.get("description", ""),
                    task.get("task_type", "human"),
                    task.get("assigned_to", ""),
                    task.get("regulation_reference"),
                    task.get("due_date"),
                ),
            )
            ids.append(cursor.lastrowid)
        conn.commit()
        return ids
    finally:
        conn.close()


def update_task_status(
    task_id: int,
    status: str,
    completed_by: Optional[str] = None,
    notes: Optional[str] = None,
) -> None:
    """Mark a task as completed, overdue, etc."""
    conn = _get_conn()
    try:
        completed_at = datetime.utcnow().isoformat() if status in ("completed", "skipped") else None
        conn.execute(
            """
            UPDATE case_tasks
            SET status = ?, completed_at = ?, completed_by = ?, notes = ?
            WHERE id = ?
            """,
            (status, completed_at, completed_by, notes, task_id),
        )
        conn.commit()
    finally:
        conn.close()


def update_case_status(case_id: int, status: str) -> None:
    """Update case status and updated_at timestamp."""
    conn = _get_conn()
    try:
        closed_at = datetime.utcnow().isoformat() if status == "closed" else None
        conn.execute(
            "UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP, closed_at = ? WHERE id = ?",
            (status, closed_at, case_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_case(case_id: int) -> dict:
    """Get full case with all tasks."""
    conn = _get_conn()
    try:
        row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
        if not row:
            return {}
        case = _row_to_dict(row)
        tasks = conn.execute(
            "SELECT * FROM case_tasks WHERE case_id = ? ORDER BY task_number", (case_id,)
        ).fetchall()
        case["tasks"] = [_row_to_dict(t) for t in tasks]
        return case
    finally:
        conn.close()


def get_case_by_number(case_number: str) -> dict:
    """Get case by case number."""
    conn = _get_conn()
    try:
        row = conn.execute("SELECT * FROM cases WHERE case_number = ?", (case_number,)).fetchone()
        if not row:
            return {}
        case = _row_to_dict(row)
        tasks = conn.execute(
            "SELECT * FROM case_tasks WHERE case_id = ? ORDER BY task_number", (case["id"],)
        ).fetchall()
        case["tasks"] = [_row_to_dict(t) for t in tasks]
        return case
    finally:
        conn.close()


def get_cases(status: Optional[str] = None, limit: int = 50) -> list[dict]:
    """Get cases filtered by status, with task summary counts included."""
    conn = _get_conn()
    try:
        base_query = """
            SELECT c.*,
              COALESCE(SUM(CASE WHEN t.task_type = 'human' THEN 1 ELSE 0 END), 0) AS task_total,
              COALESCE(SUM(CASE WHEN t.task_type = 'human' AND t.status = 'completed' THEN 1 ELSE 0 END), 0) AS task_completed,
              COALESCE(SUM(CASE WHEN t.task_type = 'human'
                AND (t.status = 'overdue' OR (t.due_date < datetime('now') AND t.status = 'pending'))
                THEN 1 ELSE 0 END), 0) AS task_overdue
            FROM cases c
            LEFT JOIN case_tasks t ON c.id = t.case_id
        """
        if status:
            rows = conn.execute(
                base_query + " WHERE c.status = ? GROUP BY c.id ORDER BY c.created_at DESC LIMIT ?",
                (status, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                base_query + " GROUP BY c.id ORDER BY c.created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_case_tasks(case_id: int) -> list[dict]:
    """Get all tasks for a case, ordered by task_number."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM case_tasks WHERE case_id = ? ORDER BY task_number", (case_id,)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_overdue_tasks() -> list[dict]:
    """Get all tasks past their due_date that are not completed."""
    conn = _get_conn()
    try:
        now = datetime.utcnow().isoformat()
        rows = conn.execute(
            """
            SELECT ct.*, c.case_number FROM case_tasks ct
            JOIN cases c ON ct.case_id = c.id
            WHERE ct.due_date < ? AND ct.status NOT IN ('completed', 'skipped', 'overdue')
            ORDER BY ct.due_date ASC
            """,
            (now,),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_case_stats() -> dict:
    """Return case counts by status."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM cases GROUP BY status"
        ).fetchall()
        by_status = {r["status"]: r["cnt"] for r in rows}
        total = conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
        auto = conn.execute("SELECT COUNT(*) FROM cases WHERE auto_processed = 1").fetchone()[0]

        # Average tasks per case
        avg_tasks_row = conn.execute(
            "SELECT AVG(task_count) FROM (SELECT COUNT(*) as task_count FROM case_tasks GROUP BY case_id)"
        ).fetchone()
        avg_tasks = round(avg_tasks_row[0] or 0, 1)

        # Average completion percentage
        completed_row = conn.execute(
            """
            SELECT AVG(CAST(completed AS REAL) / CAST(total AS REAL) * 100)
            FROM (
                SELECT
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    COUNT(*) as total
                FROM case_tasks
                GROUP BY case_id
                HAVING total > 0
            )
            """
        ).fetchone()
        avg_completion = round(completed_row[0] or 0, 1)

        overdue = conn.execute(
            "SELECT COUNT(*) FROM case_tasks WHERE status = 'overdue'"
        ).fetchone()[0]

        return {
            "total": total,
            "by_status": by_status,
            "auto_processed_pct": round(auto / total * 100, 1) if total else 0,
            "avg_tasks_per_case": avg_tasks,
            "avg_completion_pct": avg_completion,
            "overdue_tasks": overdue,
        }
    finally:
        conn.close()


def create_satisfaction_survey(case_id: int, case_number: str) -> int:
    """Create a survey record when case moves to awaiting_confirmation."""
    conn = _get_conn()
    try:
        cursor = conn.execute(
            "INSERT INTO satisfaction_surveys (case_id, case_number, status) VALUES (?, ?, 'sent')",
            (case_id, case_number),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def record_survey_response(survey_id: int, score: int, feedback: str = None) -> None:
    """Record a customer satisfaction response."""
    conn = _get_conn()
    try:
        conn.execute(
            """
            UPDATE satisfaction_surveys
            SET score = ?, feedback_text = ?, responded_at = CURRENT_TIMESTAMP, status = 'responded'
            WHERE id = ?
            """,
            (score, feedback, survey_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_satisfaction_stats() -> dict:
    """Return satisfaction survey statistics."""
    conn = _get_conn()
    try:
        total_sent = conn.execute("SELECT COUNT(*) FROM satisfaction_surveys").fetchone()[0]
        total_responded = conn.execute(
            "SELECT COUNT(*) FROM satisfaction_surveys WHERE status = 'responded'"
        ).fetchone()[0]
        avg_row = conn.execute(
            "SELECT AVG(score) FROM satisfaction_surveys WHERE score IS NOT NULL"
        ).fetchone()
        avg_score = round(avg_row[0] or 0, 2)

        dist: dict[int, int] = {}
        for row in conn.execute(
            "SELECT score, COUNT(*) as cnt FROM satisfaction_surveys WHERE score IS NOT NULL GROUP BY score"
        ).fetchall():
            dist[row["score"]] = row["cnt"]

        return {
            "total_sent": total_sent,
            "total_responded": total_responded,
            "avg_score": avg_score,
            "response_rate": round(total_responded / total_sent * 100, 1) if total_sent else 0,
            "score_distribution": dist,
        }
    finally:
        conn.close()


def save_sent_email(email_type: str, to_address: str, subject: str, case_number: str = "") -> None:
    """Record a sent email in the sent_emails table."""
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT INTO sent_emails (email_type, to_address, subject, case_number) VALUES (?, ?, ?, ?)",
            (email_type, to_address, subject, case_number),
        )
        conn.commit()
    finally:
        conn.close()


def get_recent_emails(limit: int = 50) -> list[dict]:
    """Return recent sent emails ordered by newest first."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM sent_emails ORDER BY sent_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_due_scheduled_tasks() -> list[dict]:
    """Return scheduled tasks that are due (due_date <= now) and still pending."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            """
            SELECT ct.*, c.case_number, c.complaint_id, c.product, c.assigned_team,
                   c.narrative_preview, c.status as case_status
            FROM case_tasks ct
            JOIN cases c ON ct.case_id = c.id
            WHERE ct.task_type = 'scheduled'
              AND ct.status = 'pending'
              AND ct.due_date <= datetime('now')
              AND c.status NOT IN ('closed')
            ORDER BY ct.due_date ASC
            LIMIT 20
            """,
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def record_routing_feedback(
    case_number: str,
    product: str,
    assigned_team: str,
    outcome: str,
    resolution_time_hours: float = 0.0,
    satisfaction_score: int | None = None,
) -> None:
    """Record routing outcome for learning."""
    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO routing_feedback
              (case_number, product, assigned_team, outcome, resolution_time_hours, satisfaction_score)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (case_number, product, assigned_team, outcome, resolution_time_hours, satisfaction_score),
        )
        conn.commit()
    finally:
        conn.close()


def get_routing_success_rates() -> dict:
    """Return success rate per (product, team) combination."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            """
            SELECT product, assigned_team,
                   COUNT(*) as total,
                   SUM(CASE WHEN outcome = 'resolved' THEN 1 ELSE 0 END) as resolved,
                   AVG(satisfaction_score) as avg_sat
            FROM routing_feedback
            GROUP BY product, assigned_team
            HAVING total >= 3
            """
        ).fetchall()
        result = {}
        for row in rows:
            key = f"{row['product']}::{row['assigned_team']}"
            result[key] = {
                "total": row["total"],
                "success_rate": round(row["resolved"] / row["total"], 3),
                "avg_satisfaction": round(row["avg_sat"] or 0, 2),
            }
        return result
    finally:
        conn.close()
