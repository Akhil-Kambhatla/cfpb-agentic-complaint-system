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

    try:
        resp = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=5)
        resp.raise_for_status()
        logger.info("Slack alert sent successfully")
        return True
    except Exception as exc:
        logger.error(f"Failed to send Slack alert: {exc}")
        return False
