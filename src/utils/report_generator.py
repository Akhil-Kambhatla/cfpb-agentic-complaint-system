"""Daily report generator — produces CSV summaries of processed cases."""
import csv
import logging
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

REPORTS_DIR = Path(__file__).parent.parent.parent / "data" / "reports"


def generate_daily_report(date: str = None) -> str:
    """
    Generate a CSV report for all complaints processed on a given date.

    date: ISO date string like '2026-04-07'. Defaults to today (UTC).
    Returns the file path of the generated CSV.
    """
    from src.data.database import get_cases, get_case_tasks

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    if date is None:
        date = datetime.utcnow().strftime("%Y-%m-%d")

    file_path = REPORTS_DIR / f"daily_report_{date}.csv"

    # Pull all cases and filter to those created on the target date
    cases = get_cases(limit=1000)
    target_cases = [
        c for c in cases
        if (c.get("created_at") or "").startswith(date)
    ]

    columns = [
        "Case Number", "Status", "Product", "Issue", "Severity", "Priority",
        "Team", "Confidence", "Risk Gap", "Resolution Probability",
        "Tasks Total", "Tasks Completed", "Tasks Pending", "Tasks Overdue",
        "Source", "Created At",
    ]

    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()

        for case in target_cases:
            tasks = get_case_tasks(case["id"])
            total_tasks = len(tasks)
            completed = sum(1 for t in tasks if t.get("status") == "completed")
            pending = sum(1 for t in tasks if t.get("status") == "pending")
            overdue = sum(1 for t in tasks if t.get("status") == "overdue")

            writer.writerow({
                "Case Number": case.get("case_number", ""),
                "Status": case.get("status", ""),
                "Product": case.get("product", ""),
                "Issue": case.get("issue", ""),
                "Severity": case.get("severity", ""),
                "Priority": case.get("priority", ""),
                "Team": case.get("assigned_team", ""),
                "Confidence": round(case.get("overall_confidence") or 0, 3),
                "Risk Gap": round(case.get("risk_gap") or 0, 3),
                "Resolution Probability": round(case.get("resolution_probability") or 0, 3),
                "Tasks Total": total_tasks,
                "Tasks Completed": completed,
                "Tasks Pending": pending,
                "Tasks Overdue": overdue,
                "Source": "",
                "Created At": case.get("created_at", ""),
            })

    logger.info("Daily report written to %s (%d cases)", file_path, len(target_cases))
    return str(file_path)
