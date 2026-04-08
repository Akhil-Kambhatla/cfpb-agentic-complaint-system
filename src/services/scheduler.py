"""Background scheduler for autonomous CFPB monitoring."""
import logging
import threading
from datetime import datetime, timedelta
from typing import Optional

from src.data.database import get_system_state, save_activity, set_system_state

logger = logging.getLogger(__name__)

_scheduler = None
_scheduler_lock = threading.Lock()
_start_time: Optional[datetime] = None


def _check_overdue_and_scheduled() -> None:
    """Check for overdue SLA tasks and process scheduled tasks that are now due."""
    from src.agents.autonomous_engine import check_overdue_tasks
    from src.data.database import (
        get_cases, get_case_tasks, update_task_status, update_case_status,
        create_satisfaction_survey, save_activity,
    )
    from datetime import datetime

    logger.info("[SCHEDULER] Running SLA and scheduled task check")

    # Check overdue tasks
    try:
        check_overdue_tasks()
    except Exception as exc:
        logger.error("[SCHEDULER] Overdue task check failed: %s", exc)

    # Process scheduled tasks that are now due
    now = datetime.utcnow().isoformat()
    try:
        cases = get_cases(limit=500)
        for case in cases:
            if case.get("status") in ("closed",):
                continue
            case_id = case["id"]
            case_number = case["case_number"]
            tasks = get_case_tasks(case_id)
            for task in tasks:
                if task.get("task_type") != "scheduled":
                    continue
                if task.get("status") not in ("pending",):
                    continue
                due = task.get("due_date", "")
                if due and due <= now:
                    desc = (task.get("description") or "").lower()
                    if "satisfaction survey" in desc:
                        create_satisfaction_survey(case_id, case_number)
                        save_activity(
                            "process",
                            f"[SCHEDULED] Satisfaction survey sent for case {case_number}",
                            None, "info",
                        )
                    elif "resolution notification" in desc:
                        save_activity(
                            "process",
                            f"[SCHEDULED] Resolution notification sent for case {case_number}",
                            None, "info",
                        )
                        update_case_status(case_id, "awaiting_confirmation")
                    elif "progress update" in desc:
                        save_activity(
                            "process",
                            f"[SCHEDULED] Progress update sent for case {case_number}",
                            None, "info",
                        )
                    elif "auto-close" in desc:
                        update_case_status(case_id, "closed")
                        save_activity(
                            "process",
                            f"[SCHEDULED] Case {case_number} auto-closed",
                            None, "info",
                        )
                    update_task_status(task["id"], "completed", completed_by="system")
    except Exception as exc:
        logger.error("[SCHEDULER] Scheduled task processing failed: %s", exc)


def _poll_and_process() -> None:
    """Fetch new complaints from CFPB and process them autonomously."""
    # Lazy imports to avoid circular deps at import time
    from src.data.cfpb_poller import fetch_new_since_last_poll
    from src.agents.autonomous_engine import process_batch_autonomously

    logger.info("[SCHEDULER] Triggering scheduled CFPB poll")
    save_activity("poll", "[POLL] Scheduled poll started", None, "info")

    try:
        complaints = fetch_new_since_last_poll()
    except Exception as exc:
        logger.error("[SCHEDULER] Poll failed: %s", exc)
        save_activity("error", f"[ERROR] CFPB poll failed: {exc}", None, "critical")
        return

    if not complaints:
        save_activity("poll", "[POLL] No new complaints found — system up to date", None, "info")
        return

    try:
        summary = process_batch_autonomously(complaints)
        save_activity(
            "poll",
            f"[POLL] Polled CFPB API. Found {len(complaints)} new complaints. "
            f"Processed {summary['total']}. Escalated {summary['escalated']}. "
            f"Held {summary['held']}.",
            None,
            "info",
            summary,
        )
    except Exception as exc:
        logger.error("[SCHEDULER] Batch processing failed: %s", exc)
        save_activity(
            "error", f"[ERROR] Batch processing failed: {exc}", None, "critical"
        )


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
        _scheduler.add_job(
            _poll_and_process,
            trigger="interval",
            minutes=interval_minutes,
            id="cfpb_poll",
            next_run_time=datetime.now() + timedelta(seconds=5),  # first run shortly after start
        )
        _scheduler.add_job(
            _check_overdue_and_scheduled,
            trigger="interval",
            minutes=60,
            id="sla_check",
            next_run_time=datetime.now() + timedelta(seconds=30),
        )
        _scheduler.start()
        _start_time = datetime.utcnow()

        set_system_state("monitoring_active", "true")
        set_system_state("poll_interval_minutes", str(interval_minutes))

        save_activity(
            "system_start",
            f"[SYSTEM] Autonomous monitoring started. Polling every {interval_minutes} minutes.",
            None,
            "info",
        )
        logger.info("[SCHEDULER] Monitoring started with %d-minute interval", interval_minutes)


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
    last_run = None
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

    # Run in a background thread even if scheduler isn't active
    t = threading.Thread(target=_poll_and_process, daemon=True)
    t.start()
    logger.info("[SCHEDULER] Triggered immediate poll in background thread")
