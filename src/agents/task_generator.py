"""Generates product-specific human task lists for complaint cases."""
from datetime import datetime, timedelta

# ─────────────────────────────────────────────────────────────
# Product-specific task templates — human tasks ONLY
# days_offset = calendar days from today the task is due
# ─────────────────────────────────────────────────────────────

CREDIT_CARD_TASKS = [
    {"description": "Review transaction records for disputed charge", "days_offset": 2, "regulation": "FCBA Section 161"},
    {"description": "Contact merchant for transaction documentation", "days_offset": 4},
    {"description": "Determine if provisional credit is warranted", "days_offset": 7, "regulation": "FCBA — provisional credit within 10 business days"},
    {"description": "Issue provisional credit if applicable", "days_offset": 10, "regulation": "Reg Z Section 226.13"},
    {"description": "Complete investigation and make final determination", "days_offset": 30, "regulation": "FCBA — 30-day investigation period"},
]

DEBT_COLLECTION_TASKS = [
    {"description": "Verify debt ownership and amount", "days_offset": 3, "regulation": "FDCPA Section 809 — debt validation"},
    {"description": "Check if debt is within statute of limitations", "days_offset": 3},
    {"description": "Send debt validation notice if not already sent", "days_offset": 5, "regulation": "FDCPA Section 809(b)"},
    {"description": "Cease collection activity if debt is disputed", "days_offset": 5, "regulation": "FDCPA Section 809(b)"},
    {"description": "Review third-party contact compliance", "days_offset": 5, "regulation": "FDCPA Section 805"},
    {"description": "Request credit bureau correction if reported inaccurately", "days_offset": 10, "regulation": "FCRA Section 623"},
]

CREDIT_REPORTING_TASKS = [
    {"description": "Initiate dispute with credit reporting agency", "days_offset": 2, "regulation": "FCRA Section 611"},
    {"description": "Request investigation from data furnisher", "days_offset": 3, "regulation": "FCRA Section 623"},
    {"description": "Monitor 30-day investigation deadline", "days_offset": 30, "regulation": "FCRA Section 611(a)(1)"},
    {"description": "Verify correction on credit report", "days_offset": 35},
]

MORTGAGE_TASKS = [
    {"description": "Review escrow account and payment history", "days_offset": 3, "regulation": "RESPA Section 10"},
    {"description": "Audit force-placed insurance charges if applicable", "days_offset": 5, "regulation": "RESPA Section 6"},
    {"description": "Send written acknowledgment within 5 business days", "days_offset": 5, "regulation": "RESPA Section 6(e)"},
    {"description": "Complete investigation within 30 business days", "days_offset": 30, "regulation": "RESPA Section 6(e)"},
]

CHECKING_SAVINGS_TASKS = [
    {"description": "Review account transaction history", "days_offset": 2},
    {"description": "Investigate error under Regulation E", "days_offset": 5, "regulation": "EFTA/Reg E — 10-day investigation period"},
    {"description": "Issue provisional credit within 10 business days if applicable", "days_offset": 10, "regulation": "Reg E Section 205.11"},
    {"description": "Complete investigation within 45 days", "days_offset": 45, "regulation": "Reg E Section 205.11"},
]

DEFAULT_TASKS = [
    {"description": "Review complaint details and supporting documentation", "days_offset": 3},
    {"description": "Investigate complaint and determine appropriate action", "days_offset": 10},
    {"description": "Implement corrective action", "days_offset": 15},
]

# Keyword map for fuzzy product matching
_PRODUCT_MAP = [
    (["credit card"], CREDIT_CARD_TASKS),
    (["debt collection", "debt collect"], DEBT_COLLECTION_TASKS),
    (["credit report", "consumer report", "personal consumer"], CREDIT_REPORTING_TASKS),
    (["mortgage"], MORTGAGE_TASKS),
    (["checking", "savings", "savings account"], CHECKING_SAVINGS_TASKS),
]


def _select_template(product: str) -> list[dict]:
    """Select task template based on product string (case-insensitive fuzzy match)."""
    product_lower = (product or "").lower()
    for keywords, template in _PRODUCT_MAP:
        if any(kw in product_lower for kw in keywords):
            return template
    return DEFAULT_TASKS


def generate_tasks(
    product: str,
    issue: str,
    assigned_team: str,
    resolution_steps: list[str],
) -> list[dict]:
    """
    Generate product-specific human task list for a case.
    Uses compressed timelines (minutes instead of days) for demo purposes.
    """
    template = _select_template(product)
    now = datetime.utcnow()
    tasks = []
    for task in template:
        offset = task["days_offset"]
        # Compressed timeline: days_offset minutes for live demo
        due = now + timedelta(minutes=offset * 2)
        tasks.append(
            {
                "description": task["description"],
                "task_type": "human",
                "assigned_to": assigned_team,
                "regulation_reference": task.get("regulation"),
                "due_date": due.isoformat(),
            }
        )
    return tasks
