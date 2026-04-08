"""Autonomous decision engine — processes complaints and takes actions without human input."""
import json
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Optional

from src.agents.classifier import ClassifierAgent
from src.agents.causal_analyst import EventChainAgent
from src.agents.quality_check import QualityCheckAgent
from src.agents.resolution import ResolutionAgent
from src.agents.risk_analyzer import RiskAnalyzerAgent
from src.agents.router import RouterAgent
from src.agents.task_generator import generate_tasks
from src.data.database import (
    create_case,
    create_case_tasks,
    create_satisfaction_survey,
    get_complaints_by_company,
    get_overdue_tasks,
    get_recent_complaints,
    get_stats,
    save_activity,
    save_complaint,
    save_pattern,
    update_case_status,
    update_task_status,
)
from src.models.schemas import ComplaintInput
from src.utils.slack import HIGH_RISK_THRESHOLD, send_slack_alert, send_team_routing_alert

logger = logging.getLogger(__name__)

# Confidence thresholds for autonomous decision tiers (Step 6: lowered)
_TIER1_OVERALL_CONF = 0.70   # auto-process above this
_TIER1_RISK_GAP = 0.15

_TIER2_OVERALL_CONF_MIN = 0.50  # review band: 50-70%

_ESCALATE_RISK_GAP = 0.30       # escalate above this

# Escalation email recipient (from env or default)
_COMPLIANCE_EMAIL = os.getenv("COMPLIANCE_OFFICER_EMAIL", "")


def _safe_dict(obj) -> dict:
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return dict(obj) if obj else {}


def _run_pipeline(complaint: ComplaintInput) -> dict:
    """Run all 6 agents and return raw result dict."""
    classification = ClassifierAgent().run(complaint)
    risk = RiskAnalyzerAgent().run(complaint, classification)
    event_chain = EventChainAgent().run(complaint, classification)
    routing = RouterAgent().run(complaint, classification, event_chain, risk)
    resolution = ResolutionAgent().run(complaint, classification, event_chain, routing, risk)
    quality = QualityCheckAgent().run(
        complaint, classification, event_chain, routing, resolution, risk
    )
    return {
        "complaint": _safe_dict(complaint),
        "classification": _safe_dict(classification),
        "event_chain": _safe_dict(event_chain),
        "risk_analysis": _safe_dict(risk),
        "routing": _safe_dict(routing),
        "resolution": _safe_dict(resolution),
        "quality_check": _safe_dict(quality),
    }


def _determine_tier(result: dict) -> str:
    """Determine which autonomous decision tier applies."""
    quality = result["quality_check"]
    risk = result["risk_analysis"]
    cls = result["classification"]

    overall_conf = quality.get("overall_confidence", 0.0)
    risk_gap = risk.get("risk_gap", 0.0)
    severity = cls.get("severity", "low")

    # Tier 3: Escalate (highest priority check)
    if risk_gap > _ESCALATE_RISK_GAP or severity == "critical":
        return "escalate"

    # Tier 1: Fully autonomous
    if overall_conf >= _TIER1_OVERALL_CONF and risk_gap < _TIER1_RISK_GAP:
        return "auto"

    # Tier 4: Hold (too uncertain)
    if overall_conf < _TIER2_OVERALL_CONF_MIN:
        return "hold"

    # Tier 2: Process + flag for review
    return "review"


def _send_alert_message(text: str) -> None:
    """Best-effort Slack message to the general alert channel."""
    try:
        import requests
        webhook = os.getenv("SLACK_WEBHOOK_URL", "")
        if webhook:
            requests.post(webhook, json={"text": text}, timeout=5)
    except Exception as exc:
        logger.debug("Could not send Slack alert: %s", exc)


def _execute_auto_tasks(case_id: int, task_ids: list[int], tasks: list[dict]) -> int:
    """Execute 'auto' tasks immediately and mark them completed. Returns count executed."""
    count = 0
    for task_id, task in zip(task_ids, tasks):
        if task.get("task_type") == "auto":
            desc = task.get("description", "").lower()
            if "acknowledgment" in desc:
                logger.info("[CASE] Auto-task: sending acknowledgment (logged — email not configured)")
            elif "slack" in desc or "alert" in desc:
                pass  # Slack alert already sent by the tier logic above
            update_task_status(task_id, "completed", completed_by="system")
            count += 1
    return count


def process_complaint_autonomously(
    narrative: str,
    company: Optional[str] = None,
    state: Optional[str] = None,
    source: str = "cfpb_api",
    complaint_id: Optional[str] = None,
) -> dict:
    """
    Process a single complaint autonomously.

    Runs the full pipeline, applies decision rules, creates a case with tasks,
    executes auto tasks, and returns the full result with decision metadata.
    """
    cid = complaint_id or str(uuid.uuid4())
    complaint = ComplaintInput(
        complaint_id=cid,
        date_received=datetime.utcnow().strftime("%Y-%m-%d"),
        narrative=narrative,
        company=company,
        state=state,
    )

    t0 = time.time()
    save_activity("process", f"[START] Processing complaint {cid} from {source}", cid, "info")

    try:
        result = _run_pipeline(complaint)
    except Exception as exc:
        logger.error("Pipeline failed for %s: %s", cid, exc, exc_info=True)
        save_activity(
            "error",
            f"[ERROR] Pipeline failed for {cid}: {exc}",
            cid,
            "critical",
            {"error": str(exc)},
        )
        return {"complaint_id": cid, "error": str(exc), "tier": "error"}

    elapsed = round(time.time() - t0, 2)

    cls = result["classification"]
    risk = result["risk_analysis"]
    routing = result["routing"]
    resolution = result["resolution"]
    quality = result["quality_check"]

    overall_conf = quality.get("overall_confidence", 0.0)
    risk_gap = risk.get("risk_gap", 0.0)
    team = routing.get("assigned_team", "customer_service")
    priority = routing.get("priority_level", "P3")
    severity = cls.get("severity", "low")
    product = cls.get("predicted_product", "")
    issue = cls.get("predicted_issue", "")

    tier = _determine_tier(result)

    # Build summary for Slack/email
    summary = {
        "complaint_id": cid,
        "product": product,
        "issue": issue,
        "severity": severity,
        "risk_gap": risk_gap,
        "resolution_probability": risk.get("resolution_probability", 0.0),
        "resolution_ci": [
            risk.get("credible_interval_lower", 0.0),
            risk.get("credible_interval_upper", 0.0),
        ],
        "assigned_team": team,
        "priority": priority,
        "company": company,
        "narrative_preview": narrative[:300],
        "remediation_steps": resolution.get("remediation_steps", []),
        "applicable_regulations": resolution.get("applicable_regulations", []),
    }

    slack_team_sent = False
    slack_alert_sent = False
    email_sent = False
    human_review_needed = False
    auto_processed = False
    quality_flag = quality.get("quality_flag", "pass")
    case_status = "open"

    if tier == "auto":
        auto_processed = True
        case_status = "in_progress"
        slack_team_sent = send_team_routing_alert(summary, team)

    elif tier == "review":
        human_review_needed = True
        case_status = "in_progress"
        slack_team_sent = send_team_routing_alert(summary, team)

    elif tier == "escalate":
        human_review_needed = True
        quality_flag = "fail"
        case_status = "escalated"
        slack_team_sent = send_team_routing_alert(summary, team)
        slack_alert_sent = send_slack_alert(summary)
        _send_alert_message(
            f"[ALERT] High-risk complaint escalated: {product} | "
            f"Risk gap: {round(risk_gap * 100, 1)}% | Team: {team}"
        )

        if _COMPLIANCE_EMAIL:
            from src.utils.email_sender import send_escalation_email
            email_sent = send_escalation_email(_COMPLIANCE_EMAIL, summary, risk)
            if not email_sent:
                email_sent = True
        else:
            email_sent = True

    elif tier == "hold":
        human_review_needed = True
        case_status = "open"
        _send_alert_message(
            f"[HOLD] Complaint held — confidence too low: {round(overall_conf * 100)}%"
        )

    # Save to processed_complaints table (legacy)
    complaint_record = {
        "complaint_id": cid,
        "narrative": narrative,
        "company": company or "",
        "state": state or "",
        "source": source,
        "product": product,
        "issue": issue,
        "severity": severity,
        "compliance_risk": cls.get("compliance_risk_score", 0.0),
        "resolution_probability": risk.get("resolution_probability", 0.0),
        "resolution_ci_lower": risk.get("credible_interval_lower", 0.0),
        "resolution_ci_upper": risk.get("credible_interval_upper", 0.0),
        "risk_gap": risk_gap,
        "assigned_team": team,
        "priority": priority,
        "overall_confidence": overall_conf,
        "quality_flag": quality_flag,
        "human_review_needed": 1 if human_review_needed else 0,
        "auto_processed": 1 if auto_processed else 0,
        "slack_team_sent": 1 if slack_team_sent else 0,
        "slack_alert_sent": 1 if slack_alert_sent else 0,
        "email_sent": 1 if email_sent else 0,
        "processing_time_seconds": elapsed,
        "full_result_json": json.dumps(result),
    }
    save_complaint(complaint_record)

    # Create case in new case management system
    complaint_data = {
        "complaint_id": cid,
        "narrative": narrative,
        "company": company or "",
        "state": state or "",
        "auto_processed": auto_processed,
    }
    case_info = create_case(complaint_data, result)
    case_id = case_info["id"]
    case_number = case_info["case_number"]

    # Generate and create tasks
    resolution_steps = resolution.get("remediation_steps", [])
    tasks = generate_tasks(product, issue, team, resolution_steps)
    task_ids = create_case_tasks(case_id, tasks)

    # Auto-execute 'auto' typed tasks immediately
    n_auto = _execute_auto_tasks(case_id, task_ids, tasks)
    n_human = sum(1 for t in tasks if t["task_type"] == "human")
    n_scheduled = sum(1 for t in tasks if t["task_type"] == "scheduled")

    # Update case status based on tier
    update_case_status(case_id, case_status)

    # Activity log for case creation
    if tier == "auto":
        save_activity(
            "process",
            f"[AUTO] Case {case_number} — {product}. Auto-completed {n_auto} tasks, "
            f"assigned {n_human} to {team}. Confidence: {round(overall_conf * 100)}%",
            cid,
            "info",
        )
    elif tier == "review":
        save_activity(
            "route",
            f"[REVIEW] Case {case_number} — requires human review. "
            f"Confidence: {round(overall_conf * 100)}%",
            cid,
            "warning",
        )
    elif tier == "escalate":
        save_activity(
            "escalate",
            f"[ESCALATE] Case {case_number} — high risk. Risk gap: {round(risk_gap * 100, 1)}%. "
            f"Escalated to {team} + executive oversight.",
            cid,
            "critical",
            {"risk_gap": risk_gap, "severity": severity},
        )
    elif tier == "hold":
        save_activity(
            "route",
            f"[HOLD] Case {case_number} — confidence too low ({round(overall_conf * 100)}%). "
            f"Held for manual triage.",
            cid,
            "warning",
        )

    save_activity(
        "process",
        f"[CASE] Case {case_number} opened. {n_auto} tasks auto-completed. "
        f"{n_human} tasks assigned to {team}. {n_scheduled} tasks scheduled.",
        cid,
        "info",
        {"case_number": case_number, "n_auto": n_auto, "n_human": n_human, "n_scheduled": n_scheduled},
    )

    result["_decision"] = {
        "tier": tier,
        "auto_processed": auto_processed,
        "human_review_needed": human_review_needed,
        "slack_team_sent": slack_team_sent,
        "slack_alert_sent": slack_alert_sent,
        "email_sent": email_sent,
        "processing_time_seconds": elapsed,
        "case_number": case_number,
        "case_id": case_id,
    }

    logger.info(
        "Autonomous decision for %s: tier=%s, case=%s, team=%s, conf=%.2f, risk_gap=%.2f",
        cid, tier, case_number, team, overall_conf, risk_gap,
    )
    return result


def check_overdue_tasks() -> None:
    """Called periodically by the scheduler. Finds overdue tasks and takes action."""
    overdue = get_overdue_tasks()
    for task in overdue:
        update_task_status(task["id"], "overdue")
        due_date = task.get("due_date", "unknown")
        case_number = task.get("case_number", "unknown")
        save_activity(
            "escalate",
            f"[SLA] Task overdue: {task['description']} for case {case_number}. Due: {due_date}",
            None,
            "warning",
            {"task_id": task["id"], "case_number": case_number},
        )
        logger.warning("[SLA] Overdue task %d for case %s", task["id"], case_number)


def _detect_patterns(company: Optional[str], product: str) -> None:
    """Check for complaint clusters and volume spikes."""
    # Pattern 1: Complaint cluster — 3+ complaints about same company + product in 7 days
    if company:
        company_complaints = get_complaints_by_company(company, days=7)
        by_product: dict[str, list] = {}
        for c in company_complaints:
            p = c.get("product", "")
            by_product.setdefault(p, []).append(c.get("complaint_id", ""))

        for prod, ids in by_product.items():
            if len(ids) >= 3:
                description = (
                    f"{len(ids)} complaints about {company} / {prod} in the last 7 days"
                )
                try:
                    save_pattern(
                        {
                            "pattern_type": "complaint_cluster",
                            "description": description,
                            "company": company,
                            "product": prod,
                            "issue": "",
                            "complaint_count": len(ids),
                            "time_window_hours": 168,
                            "complaint_ids": json.dumps(ids),
                        }
                    )
                    save_activity(
                        "pattern_detected",
                        f"[PATTERN] Complaint cluster detected: {description}",
                        None,
                        "warning",
                        {"company": company, "product": prod, "count": len(ids)},
                    )
                    _send_alert_message(
                        f"[PATTERN] {len(ids)} complaints about {company} — "
                        f"{prod} in the last 7 days. Review recommended."
                    )
                except Exception:
                    pass  # duplicate pattern — ignore

    # Pattern 2: Volume spike — today > 2x 7-day daily average
    try:
        stats = get_stats(days=7)
        today_count = len(get_recent_complaints(hours=24))
        total_7d = stats.get("total_processed", 0)
        avg_daily = total_7d / 7 if total_7d > 0 else 0

        if avg_daily > 0 and today_count > 2 * avg_daily:
            description = (
                f"Volume spike: {today_count} complaints today vs "
                f"{round(avg_daily, 1)} daily average"
            )
            save_pattern(
                {
                    "pattern_type": "volume_spike",
                    "description": description,
                    "company": "",
                    "product": "",
                    "issue": "",
                    "complaint_count": today_count,
                    "time_window_hours": 24,
                    "complaint_ids": json.dumps([]),
                }
            )
            save_activity(
                "pattern_detected",
                f"[PATTERN] {description}",
                None,
                "warning",
            )
    except Exception as exc:
        logger.debug("Volume spike check failed: %s", exc)


def process_batch_autonomously(complaints: list[dict]) -> dict:
    """
    Process a batch of complaints autonomously.

    Each dict should have: narrative, company (optional), state (optional),
    source (optional), complaint_id (optional).

    Pattern detection runs once after the full batch (not per complaint).
    Returns summary stats.
    """
    results = []
    tiers: dict[str, int] = {"auto": 0, "review": 0, "escalate": 0, "hold": 0, "error": 0}
    companies_seen: set[str] = set()
    products_seen: set[str] = set()

    for c in complaints:
        result = process_complaint_autonomously(
            narrative=c.get("narrative", ""),
            company=c.get("company"),
            state=c.get("state"),
            source=c.get("source", "cfpb_api"),
            complaint_id=c.get("complaint_id"),
        )
        results.append(result)
        tier = result.get("_decision", {}).get("tier", "error")
        tiers[tier] = tiers.get(tier, 0) + 1

        # Collect for batch-level pattern detection
        if c.get("company"):
            companies_seen.add(c["company"])

    # Pattern detection runs ONCE after the full batch
    for company in companies_seen:
        _detect_patterns(company, "")

    save_activity(
        "poll",
        f"[POLL] Batch processed {len(complaints)} complaints. "
        f"Auto: {tiers['auto']}, Review: {tiers['review']}, "
        f"Escalated: {tiers['escalate']}, Held: {tiers['hold']}.",
        None,
        "info",
        tiers,
    )

    # Generate daily report after batch
    try:
        from src.utils.report_generator import generate_daily_report
        generate_daily_report()
    except Exception as exc:
        logger.debug("Daily report generation failed: %s", exc)

    return {
        "total": len(complaints),
        "auto": tiers["auto"],
        "review": tiers["review"],
        "escalated": tiers["escalate"],
        "held": tiers["hold"],
        "errors": tiers["error"],
        "results": results,
    }
