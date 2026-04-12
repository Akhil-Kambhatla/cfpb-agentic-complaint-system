"""Bayesian Risk Analyzer Agent — computes posterior resolution probability with credible intervals."""
import logging
import pickle
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

from src.data.company_stats import get_company_stats
from src.models.schemas import ClassificationOutput, ComplaintInput, RiskAnalysisOutput
from src.utils.product_mapping import canonicalize_product

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent.parent.parent / "data" / "processed" / "bayesian_model.pkl"

REGULATION_KEYWORDS = re.compile(
    r"\b(CFPB|FCRA|FDCPA|TILA|EFTA|UDAAP|regulation|regulatory|statute|federal law|"
    r"compliance|violation|lawsuit|court|litigation)\b",
    re.IGNORECASE,
)
ATTORNEY_KEYWORDS = re.compile(r"\b(attorney|lawyer|legal counsel|law firm|sue|suing|sued)\b", re.IGNORECASE)
DOLLAR_KEYWORDS = re.compile(r"\$[\d,]+|\b\d[\d,]*\s*dollars?\b", re.IGNORECASE)


@lru_cache(maxsize=1)
def _load_model() -> dict:
    with open(MODEL_PATH, "rb") as f:
        data = pickle.load(f)

    # Convert all posterior_samples values to numpy arrays so arithmetic works
    ps = data.get("posterior_samples", {})
    data["posterior_samples"] = {k: np.array(v, dtype=np.float64) for k, v in ps.items()}

    # Build canonical_resolution_rates by averaging old-name rates per canonical name
    old_rates = data.get("product_resolution_rates", {})
    canonical_rates: dict[str, float] = {}
    canonical_counts: dict[str, int] = {}
    for old_name, rate in old_rates.items():
        canonical = canonicalize_product(old_name)
        if canonical not in canonical_rates:
            canonical_rates[canonical] = 0.0
            canonical_counts[canonical] = 0
        canonical_rates[canonical] += rate
        canonical_counts[canonical] += 1
    for c in canonical_rates:
        canonical_rates[c] = round(canonical_rates[c] / canonical_counts[c], 4)
    data["canonical_resolution_rates"] = canonical_rates
    # Compute overall average from old rates
    if old_rates:
        data["overall_avg_rate"] = round(sum(old_rates.values()) / len(old_rates), 4)
    else:
        data["overall_avg_rate"] = 0.369
    return data


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))


def _risk_level(risk_gap: float) -> str:
    if risk_gap > 0.3:
        return "critical"
    if risk_gap > 0.15:
        return "high"
    if risk_gap > 0.05:
        return "medium"
    return "low"


def generate_key_finding(
    resolution_prob: float,
    risk_gap: float,
    product: str,
    product_baseline: float,
) -> str:
    """Generate a human-readable key finding based on risk thresholds."""
    if risk_gap > 0.30:
        return (
            f"CRITICAL: Risk gap of {risk_gap:.0%} — resolution probability ({resolution_prob:.0%}) "
            f"is far below the {product} baseline of {product_baseline:.0%}. "
            f"Immediate escalation and senior compliance review required."
        )
    elif risk_gap > 0.20:
        return (
            f"ELEVATED RISK: Resolution probability ({resolution_prob:.0%}) is {risk_gap:.0%} below "
            f"the {product} baseline ({product_baseline:.0%}). Priority review recommended."
        )
    elif risk_gap > 0.10:
        return (
            f"MODERATE: Some gap between risk and resolution likelihood. "
            f"Resolution probability {resolution_prob:.0%} vs {product} baseline {product_baseline:.0%}. "
            f"Standard monitoring applies."
        )
    elif resolution_prob < 0.20:
        return (
            f"LOW RESOLUTION: Only {resolution_prob:.0%} chance of meaningful resolution for {product}. "
            f"This reflects the product category's historical pattern."
        )
    else:
        return (
            f"ROUTINE: Resolution probability of {resolution_prob:.0%} aligns with the "
            f"{product} baseline of {product_baseline:.0%}. Standard response procedures apply."
        )


def _recommended_action(risk_level: str, product: str) -> str:
    actions = {
        "critical": (
            f"Immediate escalation required. Resolution probability is significantly below the "
            f"{product} baseline. Assign to senior compliance officer and initiate root-cause review."
        ),
        "high": (
            "Prioritize this complaint for resolution within 24 hours. Proactively contact the "
            "consumer with a status update and concrete remediation timeline."
        ),
        "medium": (
            "Standard resolution track with enhanced monitoring. Ensure remediation steps directly "
            "address the identified risk factors to close the gap with baseline resolution rates."
        ),
        "low": (
            "Routine processing. Resolution probability aligns with or exceeds product baseline. "
            "Follow standard response procedures."
        ),
    }
    return actions.get(risk_level, actions["medium"])


class RiskAnalyzerAgent:
    """Computes Bayesian posterior resolution probability and risk metrics for a complaint."""

    def run(
        self,
        complaint: ComplaintInput,
        classification: ClassificationOutput,
    ) -> RiskAnalysisOutput:
        """Run Bayesian risk analysis. Returns RiskAnalysisOutput."""
        try:
            return self._run_bayesian(complaint, classification)
        except Exception as exc:
            logger.error(f"RiskAnalyzerAgent failed for complaint {complaint.complaint_id}: {exc}")
            return self._fallback(complaint, classification)

    def _run_bayesian(
        self,
        complaint: ComplaintInput,
        classification: ClassificationOutput,
    ) -> RiskAnalysisOutput:
        model = _load_model()
        ps = model["posterior_samples"]
        canonical_rates = model["canonical_resolution_rates"]
        sp = model["scaler_params"]

        # Truncate narrative for token efficiency (FIX 7c)
        narrative = (complaint.narrative or "")[:1500]
        product = classification.predicted_product

        # ── Feature extraction ────────────────────────────────────────────────
        # Canonicalize product for consistent rate lookup (FIX 1, 15)
        canonical_product = canonicalize_product(product)
        company_baseline = canonical_rates.get(canonical_product)
        if company_baseline is None:
            company_baseline = model.get("overall_avg_rate", 0.369)
            logger.warning(
                f"[RISK] Product '{product}' (canonical: '{canonical_product}') not in training data. "
                f"Using dataset average: {company_baseline}"
            )

        # Normalize product risk score using scaler params
        product_risk_raw = company_baseline
        product_risk = (product_risk_raw - sp["product_mean"]) / max(sp["product_std"], 1e-8)

        # Normalize narrative length
        length_raw = len(narrative)
        length_scaled = (length_raw - sp["length_mean"]) / max(sp["length_std"], 1e-8)

        # Binary narrative signals
        mentions_regulation = 1.0 if REGULATION_KEYWORDS.search(narrative) else 0.0
        mentions_attorney = 1.0 if ATTORNEY_KEYWORDS.search(narrative) else 0.0
        mentions_dollar = 1.0 if DOLLAR_KEYWORDS.search(narrative) else 0.0

        # ── Posterior predictive distribution (2000 samples) ──────────────────
        try:
            logits = (
                ps["intercept"]
                + ps["beta_product_risk"] * product_risk
                + ps["beta_narrative_length"] * length_scaled
                + ps["beta_mentions_regulation"] * mentions_regulation
                + ps["beta_mentions_attorney"] * mentions_attorney
                + ps["beta_mentions_dollar"] * mentions_dollar
            )
        except TypeError as e:
            import traceback
            logger.error(f"[RISK ANALYZER] Logit computation failed: {e}")
            logger.error(f"[RISK ANALYZER] ps key types: { {k: type(v) for k, v in ps.items()} }")
            logger.error(f"[RISK ANALYZER] product_risk type: {type(product_risk)}, value: {product_risk}")
            traceback.print_exc()
            raise
        probs = _sigmoid(logits)

        resolution_probability = float(np.mean(probs))
        posterior_std = float(np.std(probs))
        ci_lower = float(np.percentile(probs, 5))
        ci_upper = float(np.percentile(probs, 95))

        risk_gap = float(company_baseline - resolution_probability)

        # ── Regulatory risk composite score ───────────────────────────────────
        # Strengthened heuristic: product-based base + narrative signals
        narrative_lower = narrative.lower()
        product_lower = product.lower()
        high_risk_products = ["debt collection", "payday loan", "mortgage"]
        medium_risk_products = ["credit card", "credit reporting", "checking or savings"]
        if any(p in product_lower for p in high_risk_products):
            product_base = 0.35
        elif any(p in product_lower for p in medium_risk_products):
            product_base = 0.20
        else:
            product_base = 0.10

        regulatory_risk = product_base
        regulatory_risk += 0.25 * mentions_regulation
        regulatory_risk += 0.20 * mentions_attorney
        regulatory_risk += 0.10 * mentions_dollar
        # Multiple contact attempts
        if "called" in narrative_lower and any(
            w in narrative_lower for w in ("times", "multiple", "repeated")
        ):
            regulatory_risk += 0.10
        # Vulnerable consumer signals
        if any(
            w in narrative_lower for w in ("senior", "elderly", "disabled", "fixed income")
        ):
            regulatory_risk += 0.10
        # Blend with classifier's compliance_risk_score for additional signal
        regulatory_risk = float(0.6 * regulatory_risk + 0.4 * classification.compliance_risk_score)
        regulatory_risk = max(0.0, min(1.0, regulatory_risk))

        # ── Intervention effect: delta if regulation mention added ─────────────
        counterfactual_logits = (
            ps["intercept"]
            + ps["beta_product_risk"] * product_risk
            + ps["beta_narrative_length"] * length_scaled
            + ps["beta_mentions_regulation"] * 1.0  # force mention
            + ps["beta_mentions_attorney"] * mentions_attorney
            + ps["beta_mentions_dollar"] * mentions_dollar
        )
        counterfactual_probs = _sigmoid(counterfactual_logits)
        intervention_effect = float(np.mean(counterfactual_probs) - resolution_probability)

        # ── Feature contributions ─────────────────────────────────────────────
        feature_contributions = {
            "product_type": float(np.mean(ps["beta_product_risk"]) * product_risk),
            "narrative_length": float(np.mean(ps["beta_narrative_length"]) * length_scaled),
            "mentions_regulation": float(np.mean(ps["beta_mentions_regulation"]) * mentions_regulation),
            "mentions_attorney": float(np.mean(ps["beta_mentions_attorney"]) * mentions_attorney),
            "mentions_dollar": float(np.mean(ps["beta_mentions_dollar"]) * mentions_dollar),
        }

        level = _risk_level(risk_gap)

        # Model confidence is inversely proportional to posterior uncertainty
        # Lower std → higher confidence; std range ~0.01–0.15 for logistic
        confidence = float(max(0.0, min(1.0, 1.0 - posterior_std * 5)))

        # Company-level resolution rate from historical CFPB data
        company_resolution_rate: float | None = None
        company_note = ""
        if complaint.company:
            company_data = get_company_stats(complaint.company)
            if company_data:
                company_resolution_rate = company_data.get("resolution_rate")
                if company_resolution_rate is not None:
                    industry_avg = company_baseline  # use product baseline as industry proxy
                    if company_resolution_rate < industry_avg - 0.10:
                        company_note = (
                            f" This company resolves only {company_resolution_rate:.0%} of complaints "
                            f"vs {industry_avg:.0%} product baseline — elevated risk of dismissal."
                        )

        reasoning = (
            f"Bayesian logistic regression with 2,000 posterior samples. "
            f"Product baseline resolution rate: {company_baseline:.1%}. "
            f"Predicted resolution probability: {resolution_probability:.1%} "
            f"(90% CI: {ci_lower:.1%}–{ci_upper:.1%}). "
            f"Risk gap of {risk_gap:+.1%} indicates "
            f"{'under-performance relative to' if risk_gap > 0 else 'performance above'} baseline. "
            f"Narrative signals — regulation mentions: {bool(mentions_regulation)}, "
            f"attorney mentions: {bool(mentions_attorney)}, dollar amounts: {bool(mentions_dollar)}."
            f"{company_note}"
        )

        return RiskAnalysisOutput(
            resolution_probability=round(resolution_probability, 4),
            credible_interval_lower=round(ci_lower, 4),
            credible_interval_upper=round(ci_upper, 4),
            risk_gap=round(risk_gap, 4),
            regulatory_risk=round(regulatory_risk, 4),
            intervention_effect=round(intervention_effect, 4),
            company_baseline=round(company_baseline, 4),
            company_resolution_rate=round(company_resolution_rate, 4) if company_resolution_rate is not None else None,
            posterior_std=round(posterior_std, 4),
            feature_contributions={k: round(v, 4) for k, v in feature_contributions.items()},
            risk_level=level,
            recommended_action=_recommended_action(level, product),
            confidence=round(confidence, 4),
            key_finding=generate_key_finding(resolution_probability, risk_gap, product, company_baseline),
            reasoning=reasoning,
        )

    def _fallback(
        self,
        complaint: ComplaintInput,
        classification: ClassificationOutput,
    ) -> RiskAnalysisOutput:
        """Rule-based fallback when Bayesian model is unavailable."""
        risk = classification.compliance_risk_score
        gap = max(0.0, risk - 0.5)
        level = _risk_level(gap)
        res_prob = round(1.0 - risk * 0.6, 4)
        baseline = 0.35
        return RiskAnalysisOutput(
            resolution_probability=res_prob,
            credible_interval_lower=round(max(0.0, res_prob - 0.1), 4),
            credible_interval_upper=round(min(1.0, res_prob + 0.1), 4),
            risk_gap=round(gap, 4),
            regulatory_risk=round(risk, 4),
            intervention_effect=0.05,
            company_baseline=baseline,
            company_resolution_rate=None,
            posterior_std=0.1,
            feature_contributions={"compliance_risk": round(risk, 4)},
            risk_level=level,
            recommended_action=_recommended_action(level, classification.predicted_product),
            confidence=0.4,
            key_finding=generate_key_finding(res_prob, gap, classification.predicted_product, baseline),
            reasoning="Bayesian model unavailable; rule-based fallback applied using compliance_risk_score.",
        )
