"""Estimate API costs and ROI for processing CFPB complaints."""

# Claude Sonnet pricing (per token) — Anthropic pricing, April 2026
COST_PER_INPUT_TOKEN = 3.0 / 1_000_000   # $3/M input tokens
COST_PER_OUTPUT_TOKEN = 15.0 / 1_000_000  # $15/M output tokens

# Average token usage per complaint across all 6 agents
# Total: 2000 * $3/M = $0.006 input + 3000 * $15/M = $0.045 output = $0.051/complaint
AVG_INPUT_TOKENS_PER_COMPLAINT = 2000
AVG_OUTPUT_TOKENS_PER_COMPLAINT = 3000

# Derived cost per complaint for reference (not a constant — computed in estimate_cost)
# COST_PER_COMPLAINT = $0.051

# Average observed pipeline latency
AVG_PROCESSING_TIME_SECONDS = 8.4

# Historical high-risk rate from our evaluation set
HIGH_RISK_PCT = 0.086  # 8.6% of complaints flagged as high-risk


def estimate_cost(num_complaints: int) -> dict:
    """Estimate API cost and throughput for processing a batch of complaints.

    Args:
        num_complaints: Number of complaint narratives to process.

    Returns:
        dict with cost breakdown and throughput estimates.
    """
    input_cost = AVG_INPUT_TOKENS_PER_COMPLAINT * COST_PER_INPUT_TOKEN * num_complaints
    output_cost = AVG_OUTPUT_TOKENS_PER_COMPLAINT * COST_PER_OUTPUT_TOKEN * num_complaints
    total_cost = input_cost + output_cost

    total_seconds = AVG_PROCESSING_TIME_SECONDS * num_complaints
    total_hours = total_seconds / 3600
    complaints_per_minute = 60.0 / AVG_PROCESSING_TIME_SECONDS

    if total_hours < 1:
        total_minutes = total_seconds / 60
        human_readable = f"~{total_minutes:.0f} minutes"
    elif total_hours < 24:
        human_readable = f"~{total_hours:.1f} hours"
    else:
        human_readable = f"~{total_hours / 24:.1f} days"

    return {
        "num_complaints": num_complaints,
        "estimated_api_cost_usd": round(total_cost, 2),
        "estimated_time_hours": round(total_hours, 2),
        "estimated_time_human_readable": human_readable,
        "cost_per_complaint_usd": round(total_cost / max(num_complaints, 1), 4),
        "complaints_per_minute": round(complaints_per_minute, 1),
        "input_tokens_total": AVG_INPUT_TOKENS_PER_COMPLAINT * num_complaints,
        "output_tokens_total": AVG_OUTPUT_TOKENS_PER_COMPLAINT * num_complaints,
    }


def estimate_roi(num_complaints: int, avg_fine_amount: float = 500_000.0) -> dict:
    """Estimate regulatory risk exposure and ROI of using the system.

    Args:
        num_complaints: Number of complaints processed.
        avg_fine_amount: Average CFPB enforcement action / fine amount in USD.
            Default $500,000 based on public CFPB enforcement data.

    Returns:
        dict with ROI analysis.
    """
    cost_data = estimate_cost(num_complaints)
    system_cost = cost_data["estimated_api_cost_usd"]

    high_risk_count = round(num_complaints * HIGH_RISK_PCT)

    # Conservative estimate: catching 10% of high-risk complaints prevents action
    prevented_actions = max(1, round(high_risk_count * 0.10))
    potential_exposure = round(high_risk_count * avg_fine_amount * 0.05)  # 5% materialization rate
    estimated_savings = max(0.0, potential_exposure - system_cost)
    roi_multiplier = round(estimated_savings / max(system_cost, 0.01))

    # Complaints needed so that catching even 1 high-risk pays for the system
    cost_per_catch = avg_fine_amount * 0.05
    break_even = max(1, round(system_cost / cost_per_catch)) if cost_per_catch > 0 else 1

    return {
        "num_complaints": num_complaints,
        "high_risk_pct": round(HIGH_RISK_PCT * 100, 1),
        "high_risk_count": high_risk_count,
        "potential_regulatory_exposure_usd": potential_exposure,
        "system_cost_usd": system_cost,
        "estimated_savings_usd": round(estimated_savings, 2),
        "roi_multiplier": roi_multiplier,
        "break_even_complaints": break_even,
        "assumptions": {
            "avg_fine_amount_usd": avg_fine_amount,
            "exposure_materialization_rate": "5%",
            "high_risk_rate": f"{HIGH_RISK_PCT:.1%}",
        },
    }
