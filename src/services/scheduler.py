"""Background scheduler for autonomous CFPB monitoring. Always active, no demo mode."""
import logging
import threading
from datetime import datetime, timedelta
from typing import Optional

from src.data.database import get_system_state, save_activity, set_system_state

logger = logging.getLogger(__name__)

_scheduler = None
_scheduler_lock = threading.Lock()
_start_time: Optional[datetime] = None

# Auto-close awaiting_response cases after 10 minutes (gives demo time to rate)
_AUTO_CLOSE_MINUTES = 10


def _auto_close_awaiting_cases() -> None:
    """Close cases in awaiting_response that have been waiting more than 5 minutes."""
    from src.data.database import _get_conn, save_activity

    cutoff = (datetime.utcnow() - timedelta(minutes=_AUTO_CLOSE_MINUTES)).isoformat()
    closed_cases: list[str] = []

    # Phase 1: write all updates and commit, then release the connection.
    # Do NOT call save_activity while the write transaction is open — that opens a
    # second connection and races for the write lock (database locked error).
    conn = _get_conn()
    try:
        rows = conn.execute(
            """SELECT id, case_number FROM cases
               WHERE status = 'awaiting_response' AND updated_at < ?""",
            (cutoff,),
        ).fetchall()
        if not rows:
            return
        for row in rows:
            case_id = row["id"]
            case_number = row["case_number"]
            # Guard: only close if still awaiting_response (prevents double-close races)
            affected = conn.execute(
                """UPDATE cases SET status = 'closed', closed_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
                   WHERE id = ? AND status = 'awaiting_response'""",
                (case_id,),
            ).rowcount
            if affected:
                closed_cases.append(case_number)
                logger.info("[SCHEDULER] Case %s auto-closed. No dispute received.", case_number)
        conn.commit()
    except Exception as exc:
        logger.error("[SCHEDULER] Auto-close check failed: %s", exc)
    finally:
        conn.close()

    # Phase 2: log activities after the write connection is fully closed.
    for case_number in closed_cases:
        try:
            save_activity(
                "process",
                f"[CASE] Case {case_number} auto-closed — no dispute received within review period.",
                None, "info",
            )
        except Exception as exc:
            logger.error("[SCHEDULER] Failed to log auto-close activity for %s: %s", case_number, exc)


def _check_overdue_and_scheduled() -> None:
    """Check for overdue SLA tasks."""
    from src.agents.autonomous_engine import check_overdue_tasks
    logger.info("[SCHEDULER] Running SLA check")
    try:
        check_overdue_tasks()
    except Exception as exc:
        logger.error("[SCHEDULER] Overdue task check failed: %s", exc)


def _poll_and_process() -> None:
    """Fetch new complaints from CFPB (narrative + structured-only) and process them."""
    from src.data.cfpb_poller import fetch_new_since_last_poll, fetch_structured_only_complaints
    from src.agents.autonomous_engine import process_batch_autonomously

    logger.info("[SCHEDULER] Triggering scheduled CFPB poll")
    save_activity("poll", "[POLL] Scheduled poll started", None, "info")

    try:
        narrative_complaints = fetch_new_since_last_poll()
    except Exception as exc:
        logger.error("[SCHEDULER] Poll failed: %s", exc)
        save_activity("error", f"[ERROR] CFPB poll failed: {exc}", None, "critical")
        return

    # Also fetch structured-only complaints (no narrative)
    structured_complaints: list = []
    try:
        structured_complaints = fetch_structured_only_complaints(max_results=5)
    except Exception as exc:
        logger.warning("[SCHEDULER] Structured-only fetch failed: %s", exc)

    all_complaints = narrative_complaints + structured_complaints

    if not all_complaints:
        save_activity("poll", "[POLL] No new complaints found — system up to date", None, "info")
        return

    n_narrative = len(narrative_complaints)
    n_structured = len(structured_complaints)
    save_activity(
        "poll",
        f"[POLL] Found {n_narrative} complaints with narratives and "
        f"{n_structured} structured-only complaints. Processing all {len(all_complaints)}.",
        None,
        "info",
    )

    try:
        summary = process_batch_autonomously(all_complaints)
        save_activity(
            "poll",
            f"[POLL] Polled CFPB API. Processed {summary['total']} complaints "
            f"({n_narrative} narrative, {n_structured} structured). "
            f"Escalated {summary['escalated']}. Held {summary['held']}.",
            None,
            "info",
            summary,
        )
    except Exception as exc:
        logger.error("[SCHEDULER] Batch processing failed: %s", exc)
        save_activity("error", f"[ERROR] Batch processing failed: {exc}", None, "critical")


def start_monitoring(interval_minutes: int = 30) -> None:
    """Start the background APScheduler polling loop."""
    global _scheduler, _start_time

    with _scheduler_lock:
        if _scheduler is not None and _scheduler.running:
            logger.info("[SCHEDULER] Already running — ignoring start request")
            return

        try:
            from apscheduler.schedulers.background import BackgroundScheduler
        except ImportError:
            logger.error(
                "[SCHEDULER] apscheduler not installed. Run: pip install apscheduler>=3.10.0"
            )
            return

        _scheduler = BackgroundScheduler(
            job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 60}
        )
        # CFPB poll: every 30 minutes
        _scheduler.add_job(
            _poll_and_process,
            trigger="interval",
            minutes=interval_minutes,
            id="cfpb_poll",
            next_run_time=datetime.now() + timedelta(seconds=5),
        )
        # SLA overdue check: every 60 seconds
        _scheduler.add_job(
            _check_overdue_and_scheduled,
            trigger="interval",
            seconds=60,
            id="sla_check",
            next_run_time=datetime.now() + timedelta(seconds=30),
        )
        # Auto-close awaiting_response cases: every 30 seconds
        _scheduler.add_job(
            _auto_close_awaiting_cases,
            trigger="interval",
            seconds=30,
            id="auto_close",
            next_run_time=datetime.now() + timedelta(seconds=15),
        )
        _scheduler.start()
        _start_time = datetime.utcnow()

        set_system_state("monitoring_active", "true")
        set_system_state("poll_interval_minutes", str(interval_minutes))

        save_activity(
            "system_start",
            f"[SYSTEM] Autonomous monitoring started. Polling every {interval_minutes} minutes. "
            f"Auto-close check every 30s.",
            None,
            "info",
        )
        logger.info("[SCHEDULER] Monitoring started with %d-minute poll interval", interval_minutes)


def stop_monitoring() -> None:
    """Stop the background scheduler."""
    global _scheduler, _start_time

    with _scheduler_lock:
        if _scheduler is not None and _scheduler.running:
            _scheduler.shutdown(wait=False)
        _scheduler = None
        _start_time = None

        set_system_state("monitoring_active", "false")
        save_activity("system_stop", "[SYSTEM] Autonomous monitoring stopped.", None, "info")
        logger.info("[SCHEDULER] Monitoring stopped")


def get_status() -> dict:
    """Return current scheduler status."""
    global _scheduler, _start_time

    running = _scheduler is not None and _scheduler.running
    state = get_system_state()
    interval = int(state.get("poll_interval_minutes", 30))

    next_run = None
    if running and _scheduler is not None:
        try:
            job = _scheduler.get_job("cfpb_poll")
            if job and job.next_run_time:
                next_run = job.next_run_time.isoformat()
        except Exception:
            pass

    uptime = 0
    if _start_time:
        uptime = int((datetime.utcnow() - _start_time).total_seconds())

    last_poll = state.get("last_poll_time", "")

    return {
        "running": running,
        "last_poll": last_poll or None,
        "next_poll": next_run,
        "interval": interval,
        "uptime_seconds": uptime,
    }


def trigger_poll_now() -> None:
    """Trigger an immediate poll without waiting for the next scheduled run."""
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        try:
            _scheduler.modify_job("cfpb_poll", next_run_time=datetime.now())
            logger.info("[SCHEDULER] Triggered immediate poll")
            return
        except Exception as exc:
            logger.warning("[SCHEDULER] Could not modify job: %s", exc)

    t = threading.Thread(target=_poll_and_process, daemon=True)
    t.start()
    logger.info("[SCHEDULER] Triggered immediate poll in background thread")
