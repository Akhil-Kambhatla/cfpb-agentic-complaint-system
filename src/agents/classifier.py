"""Classifier Agent — classifies complaints by product, issue, severity, and compliance risk."""
import logging

from src.models.schemas import ClassificationOutput, ComplaintInput
from src.utils.llm import ask_claude_json
from src.utils.prompts import CLASSIFIER_SYSTEM, CLASSIFIER_USER_TEMPLATE

logger = logging.getLogger(__name__)

_DEFAULTS = {
    "predicted_product": "Credit reporting or other personal consumer reports",
    "predicted_sub_product": None,
    "predicted_issue": "Other features, terms, or problems",
    "predicted_sub_issue": None,
    "severity": "medium",
    "compliance_risk_score": 0.5,
    "confidence": 0.3,
    "reasoning": "Classification failed; defaults applied.",
}


class ClassifierAgent:
    """Classifies a CFPB complaint narrative into product, issue, severity, and risk."""

    def run(self, complaint: ComplaintInput) -> ClassificationOutput:
        """Run classification on a complaint. Returns ClassificationOutput."""
        narrative = complaint.narrative[:3000]  # truncate for token management
        prompt = CLASSIFIER_USER_TEMPLATE.format(
            narrative=narrative,
            company=complaint.company or "Unknown",
            state=complaint.state or "Unknown",
        )
        try:
            data = ask_claude_json(prompt, system=CLASSIFIER_SYSTEM)
            # Ensure required fields exist
            for key, default in _DEFAULTS.items():
                if key not in data or data[key] is None and key not in (
                    "predicted_sub_product", "predicted_sub_issue"
                ):
                    if key not in ("predicted_sub_product", "predicted_sub_issue"):
                        data.setdefault(key, default)
            return ClassificationOutput(**data)
        except Exception as exc:
            logger.error(f"ClassifierAgent failed for complaint {complaint.complaint_id}: {exc}")
            return ClassificationOutput(**_DEFAULTS)
