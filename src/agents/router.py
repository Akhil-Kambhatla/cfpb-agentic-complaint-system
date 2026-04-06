"""Router Agent — assigns complaints to internal teams using Bayesian risk gap for priority."""
import logging

from src.models.schemas import (
    CausalAnalysisOutput,
    ClassificationOutput,
    ComplaintInput,
    RiskAnalysisOutput,
    RoutingOutput,
)
from src.utils.llm import ask_claude_json
from src.utils.prompts import ROUTER_SYSTEM, ROUTER_USER_TEMPLATE

logger = logging.getLogger(__name__)

_DEFAULTS = {
    "assigned_team": "customer_service",
    "priority_level": "P3",
    "escalation_flag": False,
    "escalation_reason": None,
    "reasoning": "Routing failed; defaults applied.",
}


class RouterAgent:
    """Routes a complaint to the appropriate internal team and priority level."""

    def run(
        self,
        complaint: ComplaintInput,
        classification: ClassificationOutput,
        event_chain: CausalAnalysisOutput,
        risk_analysis: RiskAnalysisOutput,
    ) -> RoutingOutput:
        """Run routing using Bayesian risk gap for priority. Returns RoutingOutput."""
        prompt = ROUTER_USER_TEMPLATE.format(
            product=classification.predicted_product,
            issue=classification.predicted_issue,
            severity=classification.severity,
            compliance_risk_score=classification.compliance_risk_score,
            root_cause=event_chain.root_cause,
            risk_gap=risk_analysis.risk_gap,
            risk_level=risk_analysis.risk_level,
        )
        try:
            data = ask_claude_json(prompt, system=ROUTER_SYSTEM)
            for key, default in _DEFAULTS.items():
                data.setdefault(key, default)
            return RoutingOutput(**data)
        except Exception as exc:
            logger.error(f"RouterAgent failed for complaint {complaint.complaint_id}: {exc}")
            # Rule-based priority fallback using risk_gap
            priority = _gap_to_priority(risk_analysis.risk_gap)
            return RoutingOutput(
                assigned_team=_DEFAULTS["assigned_team"],
                priority_level=priority,
                escalation_flag=risk_analysis.risk_level in ("critical", "high"),
                escalation_reason="Bayesian risk analysis indicates elevated resolution risk." if risk_analysis.risk_level in ("critical", "high") else None,
                reasoning="Routing failed; rule-based fallback applied using risk_gap.",
            )


def _gap_to_priority(risk_gap: float) -> str:
    if risk_gap > 0.30:
        return "P1"
    if risk_gap > 0.15:
        return "P2"
    if risk_gap > 0.05:
        return "P3"
    return "P4"
