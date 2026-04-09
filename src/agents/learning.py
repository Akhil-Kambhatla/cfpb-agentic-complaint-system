"""Outcome learning — tracks routing results and adapts team assignments over time."""
import logging

from src.data.database import get_routing_success_rates, record_routing_feedback

logger = logging.getLogger(__name__)

# Keyword-to-product family mapping for fuzzy matching
_PRODUCT_KEYS = {
    "credit_card": ["credit card", "charge card", "card"],
    "debt_collection": ["debt", "collection", "collector"],
    "credit_reporting": ["credit report", "credit bureau", "equifax", "experian", "transunion", "credit score"],
    "mortgage": ["mortgage", "loan", "foreclosure", "heloc", "home equity"],
    "checking_savings": ["checking", "savings", "bank account", "deposit", "debit"],
}

# Default team per product family (fallback when no learning data)
_DEFAULT_TEAM: dict[str, str] = {
    "credit_card": "billing_disputes",
    "debt_collection": "compliance",
    "credit_reporting": "compliance",
    "mortgage": "legal",
    "checking_savings": "customer_service",
}


def _product_family(product: str) -> str:
    pl = product.lower()
    for family, keywords in _PRODUCT_KEYS.items():
        if any(k in pl for k in keywords):
            return family
    return "other"


def get_suggested_team(product: str, current_team: str) -> str:
    """
    Return the best team for this product based on historical success rates.
    Falls back to current_team if insufficient data.
    """
    try:
        rates = get_routing_success_rates()
        family = _product_family(product)

        # Find all teams that have handled this product family
        candidates: list[tuple[str, float]] = []
        for key, stats in rates.items():
            key_product, key_team = key.split("::", 1)
            if _product_family(key_product) == family and stats["total"] >= 3:
                score = stats["success_rate"] * 0.7 + (stats["avg_satisfaction"] / 5.0) * 0.3
                candidates.append((key_team, score))

        if candidates:
            best_team = max(candidates, key=lambda x: x[1])[0]
            if best_team != current_team:
                logger.info(
                    "[LEARNING] Suggesting %s over %s for %s (based on %d outcomes)",
                    best_team,
                    current_team,
                    product,
                    sum(1 for _, s in candidates),
                )
            return best_team

    except Exception as exc:
        logger.debug("[LEARNING] Could not compute team suggestion: %s", exc)

    return current_team


def record_outcome(
    case_number: str,
    product: str,
    assigned_team: str,
    outcome: str,
    resolution_time_hours: float = 0.0,
    satisfaction_score: int | None = None,
) -> None:
    """Record the outcome of a routing decision for future learning."""
    try:
        record_routing_feedback(
            case_number, product, assigned_team, outcome, resolution_time_hours, satisfaction_score
        )
        logger.info(
            "[LEARNING] Recorded outcome for %s: team=%s outcome=%s",
            case_number,
            assigned_team,
            outcome,
        )
    except Exception as exc:
        logger.debug("[LEARNING] Failed to record outcome: %s", exc)


def get_adaptive_threshold(product: str, base_threshold: float = 0.70) -> float:
    """
    Return an adaptive confidence threshold based on historical routing accuracy.
    Products with high success rates can use a slightly lower threshold.
    Products with low success rates require higher confidence before auto-routing.
    """
    try:
        rates = get_routing_success_rates()
        family = _product_family(product)

        family_rates = [
            stats["success_rate"]
            for key, stats in rates.items()
            if _product_family(key.split("::")[0]) == family and stats["total"] >= 5
        ]

        if family_rates:
            avg_success = sum(family_rates) / len(family_rates)
            # High success (>80%): lower threshold by up to 5%
            # Low success (<60%): raise threshold by up to 10%
            if avg_success >= 0.80:
                return max(0.60, base_threshold - 0.05)
            elif avg_success < 0.60:
                return min(0.85, base_threshold + 0.10)

    except Exception as exc:
        logger.debug("[LEARNING] Adaptive threshold failed: %s", exc)

    return base_threshold
