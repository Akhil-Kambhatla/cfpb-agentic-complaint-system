"""Generates product-specific task lists for complaint cases."""
from datetime import datetime, timedelta

# ─────────────────────────────────────────────────────────────
# Product-specific task templates
# days_offset = calendar days from today the task is due
# ─────────────────────────────────────────────────────────────

CREDIT_CARD_TASKS = [
    {"description": "Send complaint acknowledgment to consumer", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Alert assigned team with case details via Slack", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Review transaction records for disputed charge", "task_type": "human", "assigned_to": "{team}", "days_offset": 2, "regulation": "FCBA Section 161"},
    {"description": "Contact merchant for transaction documentation", "task_type": "human", "assigned_to": "{team}", "days_offset": 4},
    {"description": "Determine if provisional credit is warranted", "task_type": "human", "assigned_to": "{team}", "days_offset": 7, "regulation": "FCBA — provisional credit within 10 business days"},
    {"description": "Issue provisional credit if applicable", "task_type": "human", "assigned_to": "{team}", "days_offset": 10, "regulation": "Reg Z Section 226.13"},
    {"description": "Send progress update to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 5},
    {"description": "Complete investigation and make final determination", "task_type": "human", "assigned_to": "{team}", "days_offset": 30, "regulation": "FCBA — 30-day investigation period"},
    {"description": "Send resolution notification to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 31},
    {"description": "Send customer satisfaction survey", "task_type": "scheduled", "assigned_to": "system", "days_offset": 35},
    {"description": "Auto-close case if no dispute within 30 days", "task_type": "scheduled", "assigned_to": "system", "days_offset": 60},
]

DEBT_COLLECTION_TASKS = [
    {"description": "Send complaint acknowledgment to consumer", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Alert assigned team via Slack", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Verify debt ownership and amount", "task_type": "human", "assigned_to": "{team}", "days_offset": 3, "regulation": "FDCPA Section 809 — debt validation"},
    {"description": "Check if debt is within statute of limitations", "task_type": "human", "assigned_to": "{team}", "days_offset": 3},
    {"description": "Send debt validation notice if not already sent", "task_type": "human", "assigned_to": "{team}", "days_offset": 5, "regulation": "FDCPA Section 809(b)"},
    {"description": "Cease collection activity if debt is disputed", "task_type": "human", "assigned_to": "{team}", "days_offset": 5, "regulation": "FDCPA Section 809(b)"},
    {"description": "Review third-party contact compliance", "task_type": "human", "assigned_to": "{team}", "days_offset": 5, "regulation": "FDCPA Section 805"},
    {"description": "Send progress update to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 7},
    {"description": "Request credit bureau correction if reported inaccurately", "task_type": "human", "assigned_to": "{team}", "days_offset": 10, "regulation": "FCRA Section 623"},
    {"description": "Send resolution notification to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 15},
    {"description": "Send customer satisfaction survey", "task_type": "scheduled", "assigned_to": "system", "days_offset": 20},
    {"description": "Auto-close case if no dispute", "task_type": "scheduled", "assigned_to": "system", "days_offset": 45},
]

CREDIT_REPORTING_TASKS = [
    {"description": "Send complaint acknowledgment to consumer", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Alert assigned team via Slack", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Initiate dispute with credit reporting agency", "task_type": "human", "assigned_to": "{team}", "days_offset": 2, "regulation": "FCRA Section 611"},
    {"description": "Request investigation from data furnisher", "task_type": "human", "assigned_to": "{team}", "days_offset": 3, "regulation": "FCRA Section 623"},
    {"description": "Monitor 30-day investigation deadline", "task_type": "scheduled", "assigned_to": "system", "days_offset": 30, "regulation": "FCRA Section 611(a)(1) — 30-day deadline"},
    {"description": "Send progress update to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 10},
    {"description": "Verify correction on credit report", "task_type": "human", "assigned_to": "{team}", "days_offset": 35},
    {"description": "Send resolution notification with updated report details", "task_type": "scheduled", "assigned_to": "system", "days_offset": 36},
    {"description": "Send customer satisfaction survey", "task_type": "scheduled", "assigned_to": "system", "days_offset": 40},
    {"description": "Auto-close case if no dispute", "task_type": "scheduled", "assigned_to": "system", "days_offset": 60},
]

MORTGAGE_TASKS = [
    {"description": "Send complaint acknowledgment to consumer", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Alert assigned team via Slack", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Review escrow account and payment history", "task_type": "human", "assigned_to": "{team}", "days_offset": 3, "regulation": "RESPA Section 10"},
    {"description": "Audit force-placed insurance charges if applicable", "task_type": "human", "assigned_to": "{team}", "days_offset": 5, "regulation": "RESPA Section 6"},
    {"description": "Send written acknowledgment within 5 business days", "task_type": "human", "assigned_to": "{team}", "days_offset": 5, "regulation": "RESPA Section 6(e) — qualified written request"},
    {"description": "Complete investigation within 30 business days", "task_type": "human", "assigned_to": "{team}", "days_offset": 30, "regulation": "RESPA Section 6(e)"},
    {"description": "Send progress update to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 10},
    {"description": "Send resolution notification", "task_type": "scheduled", "assigned_to": "system", "days_offset": 32},
    {"description": "Send customer satisfaction survey", "task_type": "scheduled", "assigned_to": "system", "days_offset": 37},
    {"description": "Auto-close case if no dispute", "task_type": "scheduled", "assigned_to": "system", "days_offset": 60},
]

CHECKING_SAVINGS_TASKS = [
    {"description": "Send complaint acknowledgment to consumer", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Alert assigned team via Slack", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Review account transaction history", "task_type": "human", "assigned_to": "{team}", "days_offset": 2},
    {"description": "Investigate error under Regulation E", "task_type": "human", "assigned_to": "{team}", "days_offset": 5, "regulation": "EFTA/Reg E — 10-day investigation period"},
    {"description": "Issue provisional credit within 10 business days if applicable", "task_type": "human", "assigned_to": "{team}", "days_offset": 10, "regulation": "Reg E Section 205.11"},
    {"description": "Send progress update to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 7},
    {"description": "Complete investigation within 45 days", "task_type": "human", "assigned_to": "{team}", "days_offset": 45, "regulation": "Reg E Section 205.11"},
    {"description": "Send resolution notification", "task_type": "scheduled", "assigned_to": "system", "days_offset": 46},
    {"description": "Send customer satisfaction survey", "task_type": "scheduled", "assigned_to": "system", "days_offset": 50},
    {"description": "Auto-close case if no dispute", "task_type": "scheduled", "assigned_to": "system", "days_offset": 75},
]

DEFAULT_TASKS = [
    {"description": "Send complaint acknowledgment to consumer", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Alert assigned team via Slack", "task_type": "auto", "assigned_to": "system", "days_offset": 0},
    {"description": "Review complaint details and supporting documentation", "task_type": "human", "assigned_to": "{team}", "days_offset": 3},
    {"description": "Investigate complaint and determine appropriate action", "task_type": "human", "assigned_to": "{team}", "days_offset": 10},
    {"description": "Implement corrective action", "task_type": "human", "assigned_to": "{team}", "days_offset": 15},
    {"description": "Send progress update to consumer", "task_type": "scheduled", "assigned_to": "system", "days_offset": 7},
    {"description": "Send resolution notification", "task_type": "scheduled", "assigned_to": "system", "days_offset": 16},
    {"description": "Send customer satisfaction survey", "task_type": "scheduled", "assigned_to": "system", "days_offset": 21},
    {"description": "Auto-close case if no dispute", "task_type": "scheduled", "assigned_to": "system", "days_offset": 45},
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
    Generate product-specific task list for a case.

    Selects the template based on product type, substitutes {team} with the
    actual team name, and calculates due_date as today + days_offset.
    Returns a list of task dicts ready for create_case_tasks().
    """
    template = _select_template(product)
    today = datetime.utcnow()
    tasks = []
    for task in template:
        due = today + timedelta(days=task["days_offset"])
        # Format due date to end-of-business (17:00 UTC)
        due = due.replace(hour=17, minute=0, second=0, microsecond=0)
        tasks.append(
            {
                "description": task["description"].replace("{team}", assigned_team),
                "task_type": task["task_type"],
                "assigned_to": task["assigned_to"].replace("{team}", assigned_team),
                "regulation_reference": task.get("regulation"),
                "due_date": due.isoformat(),
            }
        )
    return tasks
