"""Monitor API routes for autonomous complaint processing dashboard."""
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.data.database import (
    get_active_patterns,
    get_all_activity,
    get_recent_activity,
    get_recent_complaints,
    get_stats,
    get_system_state,
    resolve_pattern,
    save_activity,
)
from src.services.scheduler import get_status, trigger_poll_now

logger = logging.getLogger(__name__)
monitor_router = APIRouter()


# ──────────────────────────────────────────────
# System status
# ──────────────────────────────────────────────

@monitor_router.get("/monitor/status")
async def monitor_status():
    """Return current monitoring system status and aggregate stats."""
    status = get_status()
    state = get_system_state()
    stats = get_stats(days=7)

    # Count today's escalated (quality_flag = fail)
    today_complaints = get_recent_complaints(hours=24, limit=200)
    escalated_today = sum(1 for c in today_complaints if c.get("quality_flag") == "fail")
    patterns = get_active_patterns()

    return {
        "monitoring_active": True,  # System is always active
        "last_poll_time": status["last_poll"],
        "next_poll_time": status["next_poll"],
        "poll_interval_minutes": status["interval"],
        "uptime_seconds": status["uptime_seconds"],
        "stats": {
            "total_processed": stats["total_processed"],
            "total_auto_processed": stats["auto_processed"],
            "total_escalated": escalated_today,
            "total_held": stats["held_for_review"],
            "total_patterns": len(patterns),
            "total_emails_sent": stats["emails_sent"],
            "total_slack_alerts": stats["slack_alerts_sent"],
        },
    }


@monitor_router.post("/monitor/poll-now")
async def poll_now():
    """Trigger an immediate CFPB API poll."""
    trigger_poll_now()
    save_activity("poll", "[POLL] Manual poll triggered by user", None, "info")
    return {
        "status": "polling",
        "message": "Poll triggered. Results will appear in the activity feed.",
    }


# ──────────────────────────────────────────────
# Activity feed
# ──────────────────────────────────────────────

@monitor_router.get("/monitor/activity")
async def get_activity(
    hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Return recent activity log entries."""
    activities = get_recent_activity(hours=hours, limit=limit)
    # Ensure timestamps are strings
    for a in activities:
        if a.get("timestamp") and not isinstance(a["timestamp"], str):
            a["timestamp"] = str(a["timestamp"])
    return {"activities": activities}


@monitor_router.get("/monitor/activity/all")
async def get_all_activity_endpoint(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Return paginated activity log."""
    activities = get_all_activity(limit=limit, offset=offset)
    return {"activities": activities, "limit": limit, "offset": offset}


# ──────────────────────────────────────────────
# Patterns
# ──────────────────────────────────────────────

@monitor_router.get("/monitor/patterns")
async def get_patterns():
    """Return all active (unresolved) patterns."""
    patterns = get_active_patterns()
    return {"patterns": patterns}


@monitor_router.post("/monitor/patterns/{pattern_id}/resolve")
async def resolve_pattern_endpoint(pattern_id: int):
    """Mark a pattern as resolved."""
    resolve_pattern(pattern_id)
    save_activity(
        "route",
        f"[PATTERN] Pattern #{pattern_id} marked as resolved by user",
        None,
        "info",
    )
    return {"status": "resolved", "pattern_id": pattern_id}


# ──────────────────────────────────────────────
# Stats
# ──────────────────────────────────────────────

@monitor_router.get("/monitor/stats")
async def monitor_stats(days: int = Query(default=7, ge=1, le=90)):
    """Return aggregate processing statistics."""
    return get_stats(days=days)


@monitor_router.get("/monitor/chart-data")
async def chart_data(days: int = Query(default=7, ge=1, le=30)):
    """Return complaint counts grouped by day for the last N days."""
    from src.data.database import get_complaints_by_day
    data = get_complaints_by_day(days=days)
    return {"data": data, "days": days}


# ──────────────────────────────────────────────
# Recent complaints
# ──────────────────────────────────────────────

@monitor_router.get("/monitor/complaints")
async def get_monitor_complaints(
    hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Return recently processed complaints (summary view)."""
    complaints = get_recent_complaints(hours=hours, limit=limit)
    summaries = []
    for c in complaints:
        narrative = c.get("narrative", "") or ""
        summaries.append(
            {
                "id": c.get("complaint_id", ""),
                "processed_at": c.get("created_at", ""),
                "narrative_preview": narrative[:100] + ("..." if len(narrative) > 100 else ""),
                "product": c.get("product", ""),
                "severity": c.get("severity", ""),
                "risk_gap": c.get("risk_gap", 0.0),
                "team": c.get("assigned_team", ""),
                "priority": c.get("priority", ""),
                "auto_processed": bool(c.get("auto_processed")),
                "human_review_needed": bool(c.get("human_review_needed")),
                "slack_alert_sent": bool(c.get("slack_alert_sent")),
                "email_sent": bool(c.get("email_sent")),
                "source": c.get("source", ""),
                "company": c.get("company", ""),
                "state": c.get("state", ""),
                "quality_flag": c.get("quality_flag", "pass"),
                "overall_confidence": c.get("overall_confidence", 0.0),
                "processing_time_seconds": c.get("processing_time_seconds", 0.0),
            }
        )
    return {"complaints": summaries}


# ──────────────────────────────────────────────
# Simulate new complaints (demo mode)
# ──────────────────────────────────────────────

_SIMULATION_COMPLAINTS = [
    {
        "narrative": "A debt collector called my workplace three times this week threatening wage garnishment for a debt I do not owe. They refuse to provide written validation despite my repeated requests. I have an attorney reviewing this matter and intend to file an FDCPA complaint with the CFPB. The amount they claim is $4,200 which I have never owed. This is causing severe distress and threatening my employment.",
        "company": "Enhanced Recovery Company",
        "state": "NY",
        "product": "Debt collection",
    },
    {
        "narrative": "My bank has been charging me unauthorized monthly fees of $45 since January, totaling over $300. When I called to dispute, they closed my account without warning, causing three automatic payments to bounce and incurring $105 in overdraft fees from linked accounts. I am a senior citizen on a fixed income and this has caused severe financial hardship. I have filed complaints with my state attorney general and intend to pursue legal action.",
        "company": "Wells Fargo",
        "state": "FL",
        "product": "Checking or savings account",
    },
    {
        "narrative": "A debt collector keeps calling me about a medical bill I already paid over a year ago. I sent proof of payment three times. They reported the debt to all three credit bureaus and my credit score dropped 85 points. They also called my elderly mother without my authorization. I have been denied an apartment rental because of this false reporting.",
        "company": "Enhanced Recovery Company",
        "state": "NY",
        "product": "Debt collection",
    },
    {
        "narrative": "My mortgage company force-placed an insurance policy for $3,200 after a brief coverage lapse. We immediately got new insurance and sent proof but they keep charging us. Our monthly payment increased by $267 and every representative gives different answers about why the backdated insurance is still on our account.",
        "company": "Bank of America",
        "state": "CA",
        "product": "Mortgage",
    },
    {
        "narrative": "My credit card company charged me $850 for a hotel booking through their travel portal after my flight was delayed. I called twice and they promised to resolve it but never called back. I filed a billing dispute and after 45 days they ruled it was my responsibility without providing investigation documents as required under the Fair Credit Billing Act.",
        "company": "Citibank",
        "state": "MD",
        "product": "Credit card",
    },
]


@monitor_router.post("/monitor/simulate")
async def simulate_complaints(count: int = Query(default=5, ge=1, le=10)):
    """
    Demo mode: process 5 diverse, clear-narrative complaints through the
    autonomous engine as if they came from the CFPB API.
    """
    complaints = [
        {
            "narrative": c["narrative"],
            "company": c["company"],
            "state": c["state"],
            "source": "simulation",
            "complaint_id": None,  # will generate UUID
        }
        for c in _SIMULATION_COMPLAINTS[:count]
    ]

    save_activity(
        "system_start",
        f"[SIMULATE] Demo simulation started: processing {len(complaints)} complaints",
        None,
        "info",
    )

    import asyncio

    loop = asyncio.get_event_loop()

    def _run_batch():
        from src.agents.autonomous_engine import process_batch_autonomously
        return process_batch_autonomously(complaints)

    summary = await loop.run_in_executor(None, _run_batch)

    return {
        "status": "complete",
        "total": summary["total"],
        "auto": summary["auto"],
        "review": summary["review"],
        "escalated": summary["escalated"],
        "held": summary["held"],
        "errors": summary["errors"],
    }


# ──────────────────────────────────────────────
# Daily report download
# ──────────────────────────────────────────────

@monitor_router.get("/reports/daily")
async def download_daily_report(date: Optional[str] = Query(default=None)):
    """Download the daily CSV report. Generates it fresh if needed."""
    if date is None:
        date = datetime.utcnow().strftime("%Y-%m-%d")

    try:
        from src.utils.report_generator import generate_daily_report
        file_path = generate_daily_report(date)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")

    from pathlib import Path
    p = Path(file_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"No report for {date}")

    return FileResponse(
        path=str(p),
        media_type="text/csv",
        filename=p.name,
    )


# ──────────────────────────────────────────────
# Email outbox
# ──────────────────────────────────────────────

@monitor_router.get("/monitor/emails")
async def get_sent_emails(limit: int = Query(default=50, ge=1, le=200)):
    """Return recent sent emails for the Email Outbox panel."""
    from src.data.database import get_recent_emails
    emails = get_recent_emails(limit=limit)
    return {"emails": emails, "total": len(emails)}


# ──────────────────────────────────────────────
# Outcome learning stats
# ──────────────────────────────────────────────

@monitor_router.get("/monitor/learning")
async def get_learning_stats():
    """Return routing outcome learning data."""
    from src.data.database import get_routing_success_rates
    rates = get_routing_success_rates()
    return {"routing_success_rates": rates, "total_pairs": len(rates)}
