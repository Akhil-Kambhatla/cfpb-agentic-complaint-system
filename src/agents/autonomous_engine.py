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
    get_complaints_by_company,
    get_existing_cluster,
    get_overdue_tasks,
    save_activity,
    save_complaint,
    save_pattern,
    update_case_status,
    update_pattern_count,
    update_pattern_recommendation,
    update_task_status,
)
from src.utils.email_sender import send_acknowledgment_email
from src.agents.learning import get_adaptive_threshold, get_suggested_team, record_outcome
from src.models.schemas import ClassificationOutput, ComplaintInput
from src.utils.product_mapping import canonicalize_product
from src.utils.satisfaction_predictor import infer_resolution_type, predict_satisfaction
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
    """Run all 6 agents and return raw result dict (includes satisfaction prediction)."""
    classification = ClassifierAgent().run(complaint)
    risk = RiskAnalyzerAgent().run(complaint, classification)
    event_chain = EventChainAgent().run(complaint, classification)
    routing = RouterAgent().run(complaint, classification, event_chain, risk)
    resolution = ResolutionAgent().run(complaint, classification, event_chain, routing, risk)
    quality = QualityCheckAgent().run(
        complaint, classification, event_chain, routing, resolution, risk
    )

    # Predicted customer satisfaction (after resolution is known)
    res_dict = _safe_dict(resolution)
    resolution_type = infer_resolution_type(res_dict)
    satisfaction = predict_satisfaction(
        product=classification.predicted_product,
        severity=classification.severity,
        resolution_probability=risk.resolution_probability,
        risk_gap=risk.risk_gap,
        resolution_type=resolution_type,
        response_time_days=resolution.estimated_resolution_days,
    )

    return {
        "complaint": _safe_dict(complaint),
        "classification": _safe_dict(classification),
        "event_chain": _safe_dict(event_chain),
        "risk_analysis": _safe_dict(risk),
        "routing": _safe_dict(routing),
        "resolution": res_dict,
        "quality_check": _safe_dict(quality),
        "predicted_satisfaction": satisfaction,
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



def generate_cluster_recommendation(
    company: str,
    product: str,
    issue: str,
    complaint_count: int,
    complaint_summaries: str,
) -> str:
    """Generate a systemic preventive recommendation for a complaint cluster using LLM."""
    try:
        from src.utils.llm import ask_claude
        prompt = (
            f"A company ({company}) has received {complaint_count} complaints about "
            f"{product} in the last 7 days. The most common issue is: {issue}.\n\n"
            f"Here are brief summaries of the complaints:\n{complaint_summaries}\n\n"
            "Generate a specific, actionable systemic recommendation that would prevent "
            "these types of complaints. Focus on process changes, policy updates, or "
            "technology improvements the company should implement. "
            "Keep it to 2-3 sentences. Be specific, not generic."
        )
        return ask_claude(prompt, max_tokens=300, agent_name="classifier")  # uses Haiku model
    except Exception as exc:
        logger.debug("Cluster recommendation generation failed: %s", exc)
        return ""


def process_structured_complaint(
    complaint_data: dict,
    source: str = "cfpb_api_structured",
) -> dict:
    """
    Process a CFPB complaint that has no narrative — only structured fields.

    Skips the Classifier (CFPB already classified it) and Event Chain (no text to analyze).
    Runs: Risk Analyzer, Router, and generates a template-based resolution.
    """
    cid = complaint_data.get("complaint_id") or str(uuid.uuid4())
    product = complaint_data.get("product", "")
    issue = complaint_data.get("issue", "")
    company = complaint_data.get("company", "")
    state = complaint_data.get("state", "")

    canonical_product = canonicalize_product(product)
    # Synthetic narrative for agents that need text
    synthetic_narrative = (
        f"Structured complaint: {canonical_product} — {issue}. "
        f"Company: {company}. State: {state}. No narrative provided."
    )

    complaint = ComplaintInput(
        complaint_id=cid,
        date_received=complaint_data.get("date_received", datetime.utcnow().strftime("%Y-%m-%d")),
        narrative=synthetic_narrative,
        product=canonical_product,
        issue=issue,
        company=company,
        state=state,
    )

    # Use CFPB's own classification — confidence is 1.0 (CFPB classified it directly)
    classification = ClassificationOutput(
        predicted_product=canonical_product,
        predicted_issue=issue or "Not specified",
        severity="medium",
        compliance_risk_score=0.5,
        confidence=1.0,
        reasoning=f"Classified by CFPB directly. Product: {canonical_product}, Issue: {issue}",
    )

    t0 = time.time()
    save_activity("process", f"[STRUCTURED] Processing structured complaint {cid}", cid, "info")

    try:
        from src.models.schemas import CausalAnalysisOutput, CausalEdge
        # Placeholder event chain for agents that require it (no narrative available)
        placeholder_event_chain = CausalAnalysisOutput(
            causal_chain=[CausalEdge(cause=issue or "Unknown", effect="Complaint filed", description="Structured-only complaint")],
            root_cause=issue or "Unknown issue — no narrative provided",
            causal_depth=1,
            counterfactual_intervention="Not available — no consumer narrative",
            prevention_recommendation="Review structured CFPB data for systemic patterns",
            confidence=0.5,
            reasoning="Structured-only complaint — no narrative to analyze",
        )
        risk = RiskAnalyzerAgent().run(complaint, classification)
        routing = RouterAgent().run(complaint, classification, placeholder_event_chain, risk)
        resolution = ResolutionAgent().run(complaint, classification, placeholder_event_chain, routing, risk)

        res_dict = _safe_dict(resolution)
        resolution_type = infer_resolution_type(res_dict)
        satisfaction = predict_satisfaction(
            product=canonical_product,
            severity="medium",
            resolution_probability=risk.resolution_probability,
            risk_gap=risk.risk_gap,
            resolution_type=resolution_type,
            response_time_days=resolution.estimated_resolution_days,
        )

        result = {
            "complaint": _safe_dict(complaint),
            "classification": _safe_dict(classification),
            "event_chain": _safe_dict(placeholder_event_chain),
            "risk_analysis": _safe_dict(risk),
            "routing": _safe_dict(routing),
            "resolution": res_dict,
            "quality_check": {"overall_confidence": 0.7, "quality_flag": "pass", "consistency_issues": [], "reasoning_trace": "Structured-only complaint", "agent_confidences": {}},
            "predicted_satisfaction": satisfaction,
            "structured_only": True,
        }
    except Exception as exc:
        logger.error("Structured pipeline failed for %s: %s", cid, exc, exc_info=True)
        save_activity("error", f"[ERROR] Structured pipeline failed for {cid}: {exc}", cid, "critical")
        return {"complaint_id": cid, "error": str(exc), "tier": "error"}

    elapsed = round(time.time() - t0, 2)
    team = result["routing"].get("assigned_team", "customer_service")
    priority = result["routing"].get("priority_level", "P3")

    complaint_record = {
        "complaint_id": cid,
        "narrative": synthetic_narrative,
        "company": company,
        "state": state,
        "source": source,
        "product": canonical_product,
        "issue": issue,
        "severity": "medium",
        "compliance_risk": 0.5,
        "resolution_probability": result["risk_analysis"].get("resolution_probability", 0.0),
        "resolution_ci_lower": result["risk_analysis"].get("credible_interval_lower", 0.0),
        "resolution_ci_upper": result["risk_analysis"].get("credible_interval_upper", 0.0),
        "risk_gap": result["risk_analysis"].get("risk_gap", 0.0),
        "assigned_team": team,
        "priority": priority,
        "overall_confidence": 0.7,
        "quality_flag": "pass",
        "human_review_needed": 0,
        "auto_processed": 1,
        "slack_team_sent": 0,
        "slack_alert_sent": 0,
        "email_sent": 0,
        "processing_time_seconds": elapsed,
        "full_result_json": json.dumps(result),
    }
    save_complaint(complaint_record)

    case_data = {
        "complaint_id": cid,
        "narrative": synthetic_narrative,
        "company": company,
        "state": state,
        "auto_processed": True,
        "source": source,
    }
    case_info = create_case(case_data, result)
    case_number = case_info["case_number"]
    case_id = case_info["id"]

    tasks = generate_tasks(canonical_product, issue, team, res_dict.get("remediation_steps", []))
    create_case_tasks(case_id, tasks)

    save_activity(
        "process",
        f"[STRUCTURED] Case {case_number} created from structured CFPB data. "
        f"Product: {canonical_product}. Team: {team}.",
        cid,
        "info",
        {"case_number": case_number, "structured_only": True},
    )

    result["_decision"] = {
        "tier": "auto",
        "auto_processed": True,
        "structured_only": True,
        "case_number": case_number,
        "case_id": case_id,
        "processing_time_seconds": elapsed,
    }
    return result


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
        case_status = "open"  # Human must click "Start Working" to advance
        slack_team_sent = send_team_routing_alert(summary, team)

    elif tier == "review":
        human_review_needed = True
        case_status = "open"
        slack_team_sent = send_team_routing_alert(summary, team)

    elif tier == "escalate":
        human_review_needed = True
        quality_flag = "fail"
        case_status = "open"  # Escalated badge shown, still starts in OPEN
        slack_team_sent = send_team_routing_alert(summary, team)
        slack_alert_sent = send_slack_alert(summary)
        _send_alert_message(
            f"[ALERT] High-risk complaint escalated: {product} | "
            f"Risk gap: {round(risk_gap * 100, 1)}% | Team: {team}"
        )

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
        "source": source,
    }
    case_info = create_case(complaint_data, result)
    case_id = case_info["id"]
    case_number = case_info["case_number"]

    # Inject case_number into summary for emails
    summary["case_number"] = case_number

    # Use adaptive threshold and learning-based team suggestion
    adaptive_conf_threshold = get_adaptive_threshold(product, _TIER1_OVERALL_CONF)
    suggested_team = get_suggested_team(product, team)
    if suggested_team != team:
        team = suggested_team
        save_activity(
            "route",
            f"[LEARNING] Re-routed to {team} based on historical outcomes for {product}",
            cid, "info",
        )

    # Generate and create tasks (human tasks only)
    resolution_steps = resolution.get("remediation_steps", [])
    tasks = generate_tasks(product, issue, team, resolution_steps)
    task_ids = create_case_tasks(case_id, tasks)
    n_human = len(tasks)

    # Send acknowledgment email to recipient
    case_data_for_email = {
        "case_number": case_number,
        "product": product,
        "assigned_team": team,
    }
    ack_sent = send_acknowledgment_email(case_data_for_email)
    email_sent = ack_sent

    # Update case status based on tier
    update_case_status(case_id, case_status)

    # Activity log for case creation
    if tier == "auto":
        save_activity(
            "process",
            f"[AUTO] Case {case_number} — {product}. {n_human} tasks assigned to {team}. "
            f"Confidence: {round(overall_conf * 100)}%",
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
        f"[CASE] Case {case_number} opened. {n_human} tasks assigned to {team}. "
        f"Acknowledgment email {'sent' if ack_sent else 'queued (email not configured)'}.",
        cid,
        "info",
        {"case_number": case_number, "n_human": n_human},
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

        # Prefer case_numbers over complaint UUIDs for display (FIX 12)
        for prod, _ in by_product.items():
            prod_complaints = [c for c in company_complaints if c.get("product", "") == prod]
            # Look up case_numbers from the cases table by complaint_id
            complaint_ids_for_prod = [c.get("complaint_id", "") for c in prod_complaints if c.get("complaint_id")]
            case_nums: list[str] = []
            if complaint_ids_for_prod:
                try:
                    from src.data.database import _get_conn as _gcn
                    _cn = _gcn()
                    try:
                        for cid in complaint_ids_for_prod[:20]:
                            row = _cn.execute("SELECT case_number FROM cases WHERE complaint_id = ? LIMIT 1", (cid,)).fetchone()
                            if row:
                                case_nums.append(row["case_number"])
                    finally:
                        _cn.close()
                except Exception:
                    pass
            ids = case_nums if case_nums else complaint_ids_for_prod

            if len(ids) >= 3:
                description = (
                    f"{len(ids)} complaints about {company} / {prod} in the last 7 days"
                )
                try:
                    existing = get_existing_cluster(company, prod)
                    if existing:
                        # Update existing cluster instead of creating a duplicate
                        update_pattern_count(existing["id"], len(ids), json.dumps(ids))
                    else:
                        pattern_id = save_pattern(
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
                        # Generate systemic preventive recommendation for the cluster
                        # Fetch actual narrative previews so the LLM gets real complaint text
                        narratives: list[str] = []
                        try:
                            from src.data.database import _get_conn as _gcn_narr
                            _cn_narr = _gcn_narr()
                            try:
                                for _ref in ids[:5]:
                                    _label = str(_ref)
                                    if _label.startswith("CIS-"):
                                        _row = _cn_narr.execute(
                                            "SELECT narrative_preview FROM cases WHERE case_number = ? LIMIT 1",
                                            (_label,),
                                        ).fetchone()
                                    else:
                                        _row = _cn_narr.execute(
                                            "SELECT narrative_preview FROM cases WHERE complaint_id = ? LIMIT 1",
                                            (_label,),
                                        ).fetchone()
                                    if _row and _row[0]:
                                        narratives.append(f"- {_row[0][:200]}")
                            finally:
                                _cn_narr.close()
                        except Exception:
                            pass
                        # Most common issue among cluster complaints
                        _issues = [c.get("issue", "") for c in prod_complaints if c.get("issue")]
                        _top_issue = max(set(_issues), key=_issues.count) if _issues else ""
                        summaries = (
                            "\n".join(narratives)
                            if narratives
                            else f"{len(ids)} complaints about {prod} from {company}"
                        )
                        rec = generate_cluster_recommendation(company, prod, _top_issue, len(ids), summaries)
                        if rec and pattern_id:
                            update_pattern_recommendation(pattern_id, rec)
                except Exception:
                    pass  # ignore errors

    # Volume spike detection removed — only complaint clusters are tracked


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
        source = c.get("source", "cfpb_api")
        narrative = c.get("narrative", "")

        # Route structured-only complaints to the lighter pipeline
        if source == "cfpb_api_structured" or not narrative.strip():
            result = process_structured_complaint(c, source=source)
        else:
            result = process_complaint_autonomously(
                narrative=narrative,
                company=c.get("company"),
                state=c.get("state"),
                source=source,
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
