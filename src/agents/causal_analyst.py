"""Event Chain Agent — extracts event sequences and performs Bayesian risk-informed analysis."""
import logging

from src.models.schemas import CausalAnalysisOutput, CausalEdge, ClassificationOutput, ComplaintInput
from src.utils.llm import ask_claude_json
from src.utils.prompts import (
    EVENT_CHAIN_SYSTEM,
    EVENT_CHAIN_USER_TEMPLATE,
    EVENT_CHAIN_USER_TEMPLATE_SHORT,
)

logger = logging.getLogger(__name__)

SHORT_NARRATIVE_THRESHOLD = 100

_DEFAULT_EDGE = {
    "cause": "Unknown initiating event",
    "effect": "Consumer complaint filed",
    "description": "Event chain analysis unavailable",
}

_DEFAULTS = {
    "causal_chain": [_DEFAULT_EDGE],
    "root_cause": "Undetermined",
    "causal_depth": 1,
    "counterfactual_intervention": "If proper procedures had been followed, this complaint would not have occurred.",
    "prevention_recommendation": "Review internal processes for compliance with applicable regulations.",
    "confidence": 0.3,
    "reasoning": "Event chain analysis failed; defaults applied.",
}


class EventChainAgent:
    """Extracts the event chain and key intervention point from a complaint narrative."""

    def run(
        self,
        complaint: ComplaintInput,
        classification: ClassificationOutput,
    ) -> CausalAnalysisOutput:
        """Run event chain analysis. Returns CausalAnalysisOutput."""
        narrative = complaint.narrative[:3000]
        is_short = len(narrative.strip()) < SHORT_NARRATIVE_THRESHOLD

        template = EVENT_CHAIN_USER_TEMPLATE_SHORT if is_short else EVENT_CHAIN_USER_TEMPLATE

        prompt = template.format(
            narrative=narrative,
            product=classification.predicted_product,
            issue=classification.predicted_issue,
            severity=classification.severity,
        )

        try:
            data = ask_claude_json(prompt, system=EVENT_CHAIN_SYSTEM)
            chain = data.get("causal_chain", [_DEFAULT_EDGE])
            if not chain:
                chain = [_DEFAULT_EDGE]
            data["causal_chain"] = chain
            data.setdefault("causal_depth", len(chain))
            return CausalAnalysisOutput(**data)
        except Exception as exc:
            logger.error(f"EventChainAgent failed for complaint {complaint.complaint_id}: {exc}")
            return CausalAnalysisOutput(
                causal_chain=[CausalEdge(**_DEFAULT_EDGE)],
                root_cause=_DEFAULTS["root_cause"],
                causal_depth=_DEFAULTS["causal_depth"],
                counterfactual_intervention=_DEFAULTS["counterfactual_intervention"],
                prevention_recommendation=_DEFAULTS["prevention_recommendation"],
                confidence=_DEFAULTS["confidence"],
                reasoning=_DEFAULTS["reasoning"],
            )


# Backwards-compatible alias used by existing orchestrator imports during transition
CausalAnalystAgent = EventChainAgent
