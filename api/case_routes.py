"""Case management API routes."""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from src.data.database import (
    create_satisfaction_survey,
    get_case_by_number,
    get_case_stats,
    get_cases,
    get_satisfaction_stats,
    save_activity,
    update_case_status,
    update_task_status,
    get_case_tasks,
)

logger = logging.getLogger(__name__)
case_router = APIRouter()


# ─────────────────────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────────────────────

class CompleteTaskRequest(BaseModel):
    notes: Optional[str] = None
    completed_by: Optional[str] = "human"


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _build_task_summary(tasks: list[dict]) -> dict:
    """Count only human tasks for progress metrics."""
    human_tasks = [t for t in tasks if t.get("task_type") == "human"]
    total = len(human_tasks)
    completed = sum(1 for t in human_tasks if t.get("status") == "completed")
    pending = sum(1 for t in human_tasks if t.get("status") == "pending")
    overdue = sum(1 for t in human_tasks if t.get("status") == "overdue")
    pct = round(completed / total * 100) if total else 0
    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "scheduled": 0,
        "overdue": overdue,
        "completion_percentage": pct,
    }


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@case_router.get("/cases")
async def list_cases(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Return cases list with summary info."""
    cases = get_cases(status=status, limit=limit)
    for c in cases:
        c.pop("full_result_json", None)
    return {"cases": cases, "total": len(cases)}


@case_router.get("/cases/stats")
async def case_stats():
    """Return case statistics."""
    stats = get_case_stats()
    satisfaction = get_satisfaction_stats()
    stats["satisfaction"] = {
        "avg_score": satisfaction["avg_score"],
        "total_responses": satisfaction["total_responded"],
        "response_rate": satisfaction["response_rate"],
    }
    return stats


@case_router.get("/cases/satisfaction")
async def satisfaction_stats():
    """Return satisfaction survey stats."""
    return get_satisfaction_stats()


@case_router.get("/cases/{case_number}")
async def get_case_detail(case_number: str):
    """Return full case detail with all tasks."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    tasks = case.get("tasks", [])
    case.pop("full_result_json", None)
    case["task_summary"] = _build_task_summary(tasks)
    return case


@case_router.post("/cases/{case_number}/start")
async def start_case(case_number: str):
    """Human picks up case — move from open to in_progress."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    if case["status"] not in ("open",):
        return {"status": case["status"], "case_number": case_number, "message": "Already started"}

    case_id = case["id"]
    update_case_status(case_id, "in_progress")
    save_activity(
        "process",
        f"[CASE] Case {case_number} picked up — moved to In Progress",
        None,
        "info",
    )
    return {"status": "in_progress", "case_number": case_number}


@case_router.post("/cases/{case_number}/tasks/{task_id}/complete")
async def complete_task(case_number: str, task_id: int, req: CompleteTaskRequest):
    """Mark a human task as completed."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    case_id = case["id"]

    tasks = get_case_tasks(case_id)
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found in case {case_number}")

    update_task_status(
        task_id,
        "completed",
        completed_by=req.completed_by or "human",
        notes=req.notes,
    )

    save_activity(
        "process",
        f"[TASK] Task '{task['description']}' completed for case {case_number} by {req.completed_by or 'human'}",
        None,
        "info",
    )

    return {"status": "completed", "task_id": task_id, "case_number": case_number}


@case_router.post("/cases/{case_number}/resolve")
async def resolve_case(case_number: str):
    """Human resolves the case — send resolution email and move to awaiting_response."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    case_id = case["id"]
    product = case.get("product", "Financial Product")

    # Get the AI-generated customer response letter from the full result JSON
    response_letter = ""
    try:
        import json
        full = json.loads(case.get("full_result_json") or "{}")
        resolution = full.get("resolution", {})
        response_letter = resolution.get("customer_response_letter", "")
    except Exception:
        pass

    if not response_letter:
        # Fallback letter
        response_letter = (
            f"Dear Consumer,\n\n"
            f"Your complaint (Case {case_number}) regarding {product} has been thoroughly reviewed "
            f"and addressed by our compliance team.\n\n"
            f"We have taken the necessary corrective actions to resolve this matter. "
            f"If you have additional questions, please reference case number {case_number}.\n\n"
            f"Sincerely,\nCFPB Complaint Intelligence System"
        )

    # Send resolution email (Email 2)
    try:
        from src.utils.email_sender import send_resolution_email
        case_data = {"case_number": case_number, "product": product}
        email_sent = send_resolution_email(case_data, response_letter)
        save_activity(
            "process",
            f"[EMAIL] Resolution email {'sent' if email_sent else 'queued'} for case {case_number}",
            None, "info",
        )
    except Exception as exc:
        logger.warning("Resolution email failed for %s: %s", case_number, exc)

    # Create satisfaction survey record
    survey_id = create_satisfaction_survey(case_id, case_number)

    # Move to awaiting_response (not closed — wait for consumer rating or auto-close)
    update_case_status(case_id, "awaiting_response")

    save_activity(
        "process",
        f"[CASE] Case {case_number} resolved. Awaiting consumer response. Survey #{survey_id} created.",
        None, "info",
    )
    return {"status": "awaiting_response", "case_number": case_number, "survey_id": survey_id}


@case_router.post("/cases/{case_number}/dispute")
async def dispute_case(case_number: str):
    """Consumer disputes resolution — create a new dispute case with -D suffix."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    from src.data.database import create_case_tasks, _get_conn
    from datetime import timedelta

    dispute_number = f"{case_number}-D"
    narrative = f"DISPUTE: Re: {case_number} — Consumer disputes resolution"
    due = (datetime.utcnow() + timedelta(minutes=6)).isoformat()

    conn = _get_conn()
    try:
        cursor = conn.execute(
            """INSERT INTO cases (
                case_number, complaint_id, status, product, issue, severity, priority,
                assigned_team, company, state, narrative_preview, resolution_probability,
                risk_gap, overall_confidence, auto_processed
            ) VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (
                dispute_number,
                case.get("complaint_id", ""),
                case.get("product", ""),
                case.get("issue", ""),
                case.get("severity", "high"),
                "P1",
                case.get("assigned_team", "compliance"),
                case.get("company", ""),
                case.get("state", ""),
                narrative,
                0.0,
                0.5,
                0.8,
            ),
        )
        conn.commit()
        dispute_case_id = cursor.lastrowid
    finally:
        conn.close()

    create_case_tasks(dispute_case_id, [{
        "description": f"Re-investigate: consumer disputed resolution of {case_number}",
        "task_type": "human",
        "assigned_to": case.get("assigned_team", "compliance"),
        "regulation_reference": None,
        "due_date": due,
    }])

    save_activity(
        "escalate",
        f"[DISPUTE] New dispute case {dispute_number} created referencing {case_number}",
        None, "warning",
    )

    return {"status": "dispute_created", "dispute_case_number": dispute_number, "original_case_number": case_number}


# ─────────────────────────────────────────────────────────────
# Satisfaction rating endpoint (called from email link)
# ─────────────────────────────────────────────────────────────

@case_router.get("/satisfaction/{case_number}/rate", response_class=HTMLResponse)
async def rate_satisfaction(case_number: str, score: int = Query(..., ge=1, le=5)):
    """Consumer clicks rating link in email — record score and return thank-you page."""
    case = get_case_by_number(case_number)
    if not case:
        return HTMLResponse(content="<html><body><h1>Case not found</h1></body></html>", status_code=404)

    case_id = case["id"]

    # Find or create survey record
    from src.data.database import _get_conn
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT id FROM satisfaction_surveys WHERE case_number = ? ORDER BY sent_at DESC LIMIT 1",
            (case_number,),
        ).fetchone()
        if row:
            survey_id = row["id"]
            conn.execute(
                """UPDATE satisfaction_surveys
                   SET score = ?, responded_at = CURRENT_TIMESTAMP, status = 'responded'
                   WHERE id = ?""",
                (score, survey_id),
            )
        else:
            cursor = conn.execute(
                "INSERT INTO satisfaction_surveys (case_id, case_number, score, status, responded_at) VALUES (?, ?, ?, 'responded', CURRENT_TIMESTAMP)",
                (case_id, case_number, score),
            )
            survey_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()

    # Update case satisfaction score
    conn2 = _get_conn()
    try:
        conn2.execute(
            "UPDATE cases SET customer_satisfaction_score = ? WHERE case_number = ?",
            (score, case_number),
        )
        # Also close the case now that we have a rating
        conn2.execute(
            "UPDATE cases SET status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE case_number = ? AND status = 'awaiting_response'",
            (case_number,),
        )
        conn2.commit()
    finally:
        conn2.close()

    save_activity(
        "process",
        f"[SURVEY] Customer rated case {case_number}: {score}/5",
        None, "info",
    )

    return HTMLResponse(content=f"""<!DOCTYPE html>
<html>
<head><title>Thank You</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 60px 20px;">
  <h1 style="color: #059669;">Thank You!</h1>
  <p style="font-size: 18px; color: #374151;">
    Your rating of <strong>{score}/5</strong> for Case {case_number} has been recorded.
  </p>
  <p style="color: #6b7280;">
    Your feedback helps us improve our complaint resolution process.
  </p>
  <p style="color: #9ca3af; margin-top: 40px; font-size: 14px;">
    CFPB Complaint Intelligence System — UMD Agentic AI Challenge 2026
  </p>
</body>
</html>""")
