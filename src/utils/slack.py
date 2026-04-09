"""Send real Slack notifications for high-risk complaints."""
import logging
import os
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SLACK_WEBHOOK_URL: Optional[str] = os.getenv("SLACK_WEBHOOK_URL")
HIGH_RISK_THRESHOLD: float = float(os.getenv("SLACK_RISK_THRESHOLD", "0.2"))

# Per-team Slack webhook URLs
TEAM_WEBHOOK_MAP: dict[str, Optional[str]] = {
    "compliance": os.getenv("SLACK_WEBHOOK_COMPLIANCE"),
    "billing_disputes": os.getenv("SLACK_WEBHOOK_BILLING_DISPUTES"),
    "fraud": os.getenv("SLACK_WEBHOOK_FRAUD"),
    "customer_service": os.getenv("SLACK_WEBHOOK_CUSTOMER_SERVICE"),
    "legal": os.getenv("SLACK_WEBHOOK_LEGAL"),
    "executive_escalation": os.getenv("SLACK_WEBHOOK_EXECUTIVE_ESCALATION"),
}

# Startup webhook configuration check
logger.info(f"[SLACK] General webhook: {'configured' if os.getenv('SLACK_WEBHOOK_URL') else 'MISSING'}")
_TEAM_ENV_VARS = [
    ("compliance", "SLACK_WEBHOOK_COMPLIANCE"),
    ("billing_disputes", "SLACK_WEBHOOK_BILLING_DISPUTES"),
    ("fraud", "SLACK_WEBHOOK_FRAUD"),
    ("customer_service", "SLACK_WEBHOOK_CUSTOMER_SERVICE"),
    ("legal", "SLACK_WEBHOOK_LEGAL"),
    ("executive_escalation", "SLACK_WEBHOOK_EXECUTIVE_ESCALATION"),
]
for _team, _env_var in _TEAM_ENV_VARS:
    _url = os.getenv(_env_var)
    logger.info(f"[SLACK] {_team} webhook: {'configured' if _url else 'MISSING'}")


def send_slack_alert(complaint_summary: dict) -> bool:
    """Send a Slack Block Kit alert for a high-risk complaint.

    Args:
        complaint_summary: dict with keys: product, severity, risk_gap,
            resolution_probability, resolution_ci, assigned_team, priority,
            company (optional), narrative_preview (first 200 chars of narrative)

    Returns:
        True if the alert was sent successfully, False otherwise.
    """
    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL not set — skipping Slack alert")
        return False

    risk_gap = complaint_summary.get("risk_gap", 0.0)
    if risk_gap <= HIGH_RISK_THRESHOLD:
        logger.debug(f"risk_gap {risk_gap:.2f} below threshold {HIGH_RISK_THRESHOLD} — skipping alert")
        return False

    product = complaint_summary.get("product", "Unknown")
    severity = (complaint_summary.get("severity") or "unknown").upper()
    resolution_prob = complaint_summary.get("resolution_probability", 0.0)
    ci = complaint_summary.get("resolution_ci", [0.0, 0.0])
    ci_low = ci[0] if isinstance(ci, (list, tuple)) and len(ci) >= 2 else 0.0
    ci_high = ci[1] if isinstance(ci, (list, tuple)) and len(ci) >= 2 else 0.0
    assigned_team = complaint_summary.get("assigned_team", "Unknown")
    priority = complaint_summary.get("priority", "P1")
    company = complaint_summary.get("company") or "Not specified"
    narrative_preview = (complaint_summary.get("narrative_preview") or "")[:200]

    payload = {
        "attachments": [
            {
                "color": "#e11d48",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "⚠️ High-Risk Complaint Detected",
                            "emoji": True,
                        },
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Product:*\n{product}"},
                            {"type": "mrkdwn", "text": f"*Severity:*\n{severity}"},
                            {
                                "type": "mrkdwn",
                                "text": f"*Risk Gap:*\n{risk_gap:.0%}",
                            },
                            {
                                "type": "mrkdwn",
                                "text": (
                                    f"*Resolution Probability:*\n"
                                    f"{resolution_prob:.0%} "
                                    f"(CI: {ci_low:.0%} – {ci_high:.0%})"
                                ),
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Assigned Team:*\n{assigned_team} (Priority: {priority})",
                            },
                            {"type": "mrkdwn", "text": f"*Company:*\n{company}"},
                        ],
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Complaint excerpt:*\n_{narrative_preview}_",
                        },
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": (
                                    "Human review recommended — this complaint has high regulatory risk "
                                    "but low likelihood of resolution under standard handling."
                                ),
                            }
                        ],
                    },
                ],
            }
        ]
    }

    for attempt in range(2):
        try:
            resp = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=5)
            resp.raise_for_status()
            logger.info("Slack alert sent successfully")
            return True
        except Exception as exc:
            if attempt == 0:
                import time; time.sleep(1)
            else:
                logger.error(f"Failed to send Slack alert: {exc}")
    return False


def send_team_routing_alert(complaint_summary: dict, assigned_team: str) -> bool:
    """Send a routing notification to the specific team's Slack channel.

    Args:
        complaint_summary: dict with keys: product, issue, severity, risk_gap,
            resolution_probability, resolution_ci, priority, company,
            narrative_preview, remediation_steps, applicable_regulations
        assigned_team: team key, e.g. "billing_disputes"

    Returns:
        True if the alert was sent successfully, False otherwise.
    """
    logger.info(f"[SLACK] send_team_routing_alert called for team: {assigned_team}")
    webhook_url = TEAM_WEBHOOK_MAP.get(assigned_team)
    logger.info(f"[SLACK] Webhook URL found: {bool(webhook_url)}")
    if not webhook_url:
        logger.warning(f"[SLACK] No webhook configured for team '{assigned_team}' — skipping team alert. "
                       f"Available teams: {list(TEAM_WEBHOOK_MAP.keys())}")
        return False

    product = complaint_summary.get("product", "Unknown")
    issue = complaint_summary.get("issue", "Unknown")
    severity = (complaint_summary.get("severity") or "unknown").upper()
    risk_gap = complaint_summary.get("risk_gap", 0.0)
    resolution_prob = complaint_summary.get("resolution_probability", 0.0)
    ci = complaint_summary.get("resolution_ci", [0.0, 0.0])
    ci_low = ci[0] if isinstance(ci, (list, tuple)) and len(ci) >= 2 else 0.0
    ci_high = ci[1] if isinstance(ci, (list, tuple)) and len(ci) >= 2 else 0.0
    priority = complaint_summary.get("priority", "P3")
    company = complaint_summary.get("company") or "Not specified"
    narrative_preview = (complaint_summary.get("narrative_preview") or "")[:300]
    remediation_steps: list[str] = complaint_summary.get("remediation_steps") or []
    applicable_regulations: list[str] = complaint_summary.get("applicable_regulations") or []

    is_urgent = priority in ("P1", "P2")
    color = "#e11d48" if is_urgent else "#0284c7"
    priority_emoji = {"P1": "🔴", "P2": "🟠", "P3": "🟡", "P4": "🟢"}.get(priority, "🟡")

    steps_text = (
        "\n".join(f"{i + 1}. {step}" for i, step in enumerate(remediation_steps[:5]))
        if remediation_steps else "No steps generated"
    )
    regs_text = ", ".join(applicable_regulations) if applicable_regulations else "None identified"

    payload = {
        "attachments": [
            {
                "color": color,
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "📋 New Complaint Routed to Your Team",
                            "emoji": True,
                        },
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Priority:*\n{priority_emoji} {priority}"},
                            {"type": "mrkdwn", "text": f"*Product:*\n{product}"},
                            {"type": "mrkdwn", "text": f"*Issue:*\n{issue}"},
                            {"type": "mrkdwn", "text": f"*Severity:*\n{severity}"},
                            {"type": "mrkdwn", "text": f"*Risk Gap:*\n{risk_gap:.0%}"},
                            {
                                "type": "mrkdwn",
                                "text": (
                                    f"*Resolution Probability:*\n"
                                    f"{resolution_prob:.0%} (CI: {ci_low:.0%}–{ci_high:.0%})"
                                ),
                            },
                            {"type": "mrkdwn", "text": f"*Company:*\n{company}"},
                        ],
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Complaint excerpt:*\n_{narrative_preview}_",
                        },
                    },
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": f"*Remediation Steps:*\n{steps_text}"},
                    },
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": f"*Applicable Regulations:* {regs_text}"},
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": "Assigned via CFPB Complaint Intelligence System",
                            }
                        ],
                    },
                ],
            }
        ]
    }

    channel = f"team-{assigned_team.replace('_', '-')}"
    for attempt in range(2):
        try:
            resp = requests.post(webhook_url, json=payload, timeout=5)
            resp.raise_for_status()
            logger.info(f"Team routing alert sent to #{channel}")
            return True
        except Exception as exc:
            if attempt == 0:
                import time; time.sleep(1)
            else:
                logger.error(f"Failed to send team routing alert to '{assigned_team}': {exc}")
    return False
