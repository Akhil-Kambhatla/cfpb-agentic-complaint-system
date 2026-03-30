"""Quality Check Agent — validates consistency and assigns confidence scores."""
import logging

from src.models.schemas import (
    CausalAnalysisOutput,
    ClassificationOutput,
    ComplaintInput,
    QualityCheckOutput,
    ResolutionOutput,
    RoutingOutput,
)
from src.utils.llm import ask_claude_json
from src.utils.prompts import QUALITY_CHECK_SYSTEM, QUALITY_CHECK_USER_TEMPLATE

logger = logging.getLogger(__name__)

_DEFAULTS = {
    "overall_confidence": 0.5,
    "quality_flag": "review",
    "consistency_issues": ["Quality check failed; manual review required"],
    "reasoning_trace": "Quality check could not be completed automatically.",
    "agent_confidences": {
        "classifier": 0.5,
        "causal_analyst": 0.5,
        "router": 0.5,
        "resolution": 0.5,
    },
}


class QualityCheckAgent:
    """Reviews all pipeline outputs for consistency and quality."""

    def run(
        self,
        complaint: ComplaintInput,
        classification: ClassificationOutput,
        causal_analysis: CausalAnalysisOutput,
        routing: RoutingOutput,
        resolution: ResolutionOutput,
    ) -> QualityCheckOutput:
        """Run quality check. Returns QualityCheckOutput."""
        narrative = complaint.narrative[:1000]  # shorter for quality check context

        prompt = QUALITY_CHECK_USER_TEMPLATE.format(
            narrative=narrative,
            product=classification.predicted_product,
            issue=classification.predicted_issue,
            severity=classification.severity,
            compliance_risk_score=classification.compliance_risk_score,
            classifier_confidence=classification.confidence,
            root_cause=causal_analysis.root_cause,
            causal_depth=causal_analysis.causal_depth,
            counterfactual_intervention=causal_analysis.counterfactual_intervention,
            causal_confidence=causal_analysis.confidence,
            assigned_team=routing.assigned_team,
            priority_level=routing.priority_level,
            escalation_flag=routing.escalation_flag,
            remediation_steps=resolution.remediation_steps,
            applicable_regulations=resolution.applicable_regulations,
            estimated_resolution_days=resolution.estimated_resolution_days,
        )
        try:
            data = ask_claude_json(prompt, system=QUALITY_CHECK_SYSTEM)
            for key, default in _DEFAULTS.items():
                data.setdefault(key, default)
            if not isinstance(data.get("consistency_issues"), list):
                data["consistency_issues"] = []
            if not isinstance(data.get("agent_confidences"), dict):
                data["agent_confidences"] = _DEFAULTS["agent_confidences"]
            return QualityCheckOutput(**data)
        except Exception as exc:
            logger.error(f"QualityCheckAgent failed for complaint {complaint.complaint_id}: {exc}")
            return QualityCheckOutput(**_DEFAULTS)
