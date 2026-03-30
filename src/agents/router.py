"""Router Agent — assigns complaints to internal teams with priority levels."""
import logging

from src.models.schemas import (
    CausalAnalysisOutput,
    ClassificationOutput,
    ComplaintInput,
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
        causal_analysis: CausalAnalysisOutput,
    ) -> RoutingOutput:
        """Run routing. Returns RoutingOutput."""
        prompt = ROUTER_USER_TEMPLATE.format(
            product=classification.predicted_product,
            issue=classification.predicted_issue,
            severity=classification.severity,
            compliance_risk_score=classification.compliance_risk_score,
            root_cause=causal_analysis.root_cause,
        )
        try:
            data = ask_claude_json(prompt, system=ROUTER_SYSTEM)
            for key, default in _DEFAULTS.items():
                data.setdefault(key, default)
            return RoutingOutput(**data)
        except Exception as exc:
            logger.error(f"RouterAgent failed for complaint {complaint.complaint_id}: {exc}")
            return RoutingOutput(**_DEFAULTS)
