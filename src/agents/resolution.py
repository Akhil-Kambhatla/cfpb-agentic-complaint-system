"""Resolution Agent — generates remediation plans and customer response letters."""
import logging

from src.config import REGULATIONS_MAP
from src.models.schemas import (
    CausalAnalysisOutput,
    ClassificationOutput,
    ComplaintInput,
    ResolutionOutput,
    RiskAnalysisOutput,
    RoutingOutput,
)
from src.utils.llm import ask_claude_json
from src.utils.prompts import RESOLUTION_SYSTEM, RESOLUTION_USER_TEMPLATE

logger = logging.getLogger(__name__)

_DEFAULTS = {
    "remediation_steps": ["Review complaint details", "Contact consumer within required timeframe"],
    "customer_response_letter": (
        "Dear Consumer,\n\nThank you for bringing this matter to our attention. "
        "We have received your complaint and are reviewing it in accordance with applicable regulations. "
        "We will respond within the required timeframe.\n\nSincerely,\nCompliance Team"
    ),
    "preventive_recommendations": ["Review internal procedures for compliance"],
    "applicable_regulations": ["CFPA", "UDAAP"],
    "estimated_resolution_days": 30,
    "reasoning": "Resolution generation failed; defaults applied.",
}


def _get_regulations(product: str) -> list[str]:
    """Return applicable regulations for a product type."""
    for key in REGULATIONS_MAP:
        if key.lower() in product.lower():
            return REGULATIONS_MAP[key]
    return REGULATIONS_MAP["default"]


class ResolutionAgent:
    """Generates resolution plans and regulatory-compliant customer response letters."""

    def run(
        self,
        complaint: ComplaintInput,
        classification: ClassificationOutput,
        event_chain: CausalAnalysisOutput,
        routing: RoutingOutput,
        risk_analysis: RiskAnalysisOutput,
    ) -> ResolutionOutput:
        """Run resolution generation. Returns ResolutionOutput."""
        narrative = complaint.narrative[:3000]
        regulations = _get_regulations(classification.predicted_product)

        prompt = RESOLUTION_USER_TEMPLATE.format(
            narrative=narrative,
            product=classification.predicted_product,
            issue=classification.predicted_issue,
            severity=classification.severity,
            compliance_risk_score=classification.compliance_risk_score,
            root_cause=event_chain.root_cause,
            counterfactual_intervention=event_chain.counterfactual_intervention,
            resolution_probability=risk_analysis.resolution_probability,
            risk_gap=risk_analysis.risk_gap,
            recommended_action=risk_analysis.recommended_action,
            assigned_team=routing.assigned_team,
            priority_level=routing.priority_level,
            regulations=", ".join(regulations),
        )
        try:
            data = ask_claude_json(prompt, system=RESOLUTION_SYSTEM)
            for key, default in _DEFAULTS.items():
                data.setdefault(key, default)
            if not data.get("remediation_steps"):
                data["remediation_steps"] = _DEFAULTS["remediation_steps"]
            if not data.get("preventive_recommendations"):
                data["preventive_recommendations"] = _DEFAULTS["preventive_recommendations"]
            return ResolutionOutput(**data)
        except Exception as exc:
            logger.error(f"ResolutionAgent failed for complaint {complaint.complaint_id}: {exc}")
            return ResolutionOutput(**_DEFAULTS)
