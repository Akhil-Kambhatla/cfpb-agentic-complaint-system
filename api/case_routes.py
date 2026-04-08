"""Case management API routes."""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
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
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    pending = sum(1 for t in tasks if t.get("status") == "pending")
    scheduled = sum(1 for t in tasks if t.get("task_type") == "scheduled" and t.get("status") == "pending")
    overdue = sum(1 for t in tasks if t.get("status") == "overdue")
    pct = round(completed / total * 100) if total else 0
    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "scheduled": scheduled,
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
    # Strip large json field for list view
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


@case_router.post("/cases/{case_number}/tasks/{task_id}/complete")
async def complete_task(case_number: str, task_id: int, req: CompleteTaskRequest):
    """Mark a human task as completed."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    case_id = case["id"]

    # Verify the task belongs to this case
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
        f"[TASK] Task {task_id} completed for case {case_number} by {req.completed_by or 'human'}",
        None,
        "info",
    )

    # Check if all human tasks are done — if so, advance case to action_taken
    updated_tasks = get_case_tasks(case_id)
    human_tasks = [t for t in updated_tasks if t["task_type"] == "human"]
    all_human_done = all(t["status"] in ("completed", "skipped") for t in human_tasks)
    if all_human_done and human_tasks:
        update_case_status(case_id, "action_taken")
        save_activity(
            "process",
            f"[CASE] Case {case_number} advanced to action_taken — all human tasks complete",
            None,
            "info",
        )

    return {"status": "completed", "task_id": task_id, "case_number": case_number}


@case_router.post("/cases/{case_number}/resolve")
async def resolve_case(case_number: str):
    """Consumer confirms resolution — close the case and trigger satisfaction survey."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    case_id = case["id"]
    update_case_status(case_id, "closed")
    survey_id = create_satisfaction_survey(case_id, case_number)

    save_activity(
        "process",
        f"[CASE] Case {case_number} closed by consumer confirmation. Survey #{survey_id} sent.",
        None,
        "info",
    )

    return {"status": "closed", "case_number": case_number, "survey_id": survey_id}


@case_router.post("/cases/{case_number}/dispute")
async def dispute_case(case_number: str):
    """Consumer disputes resolution — keep case open and create escalation task."""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")

    case_id = case["id"]
    # Case stays in awaiting_confirmation / reopen to in_progress
    update_case_status(case_id, "in_progress")

    from src.data.database import create_case_tasks
    from datetime import timedelta
    due = (datetime.utcnow() + timedelta(days=3)).replace(hour=17, minute=0, second=0, microsecond=0)
    create_case_tasks(case_id, [{
        "description": "Consumer disputed resolution — escalate and re-investigate",
        "task_type": "human",
        "assigned_to": case.get("assigned_team", ""),
        "regulation_reference": None,
        "due_date": due.isoformat(),
    }])

    save_activity(
        "escalate",
        f"[CASE] Case {case_number} disputed by consumer. New escalation task created.",
        None,
        "warning",
    )

    return {"status": "disputed", "case_number": case_number}
