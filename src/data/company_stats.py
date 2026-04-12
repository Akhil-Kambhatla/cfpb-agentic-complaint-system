"""Per-company statistics computed from the development dataset."""
import logging
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "processed" / "analysis_100k.csv"

_RESPONSE_POSITIVE = {
    "Closed with monetary relief",
    "Closed with non-monetary relief",
    "Closed with explanation",
}


@lru_cache(maxsize=1)
def _load_stats() -> dict[str, dict]:
    """Load and compute per-company stats from dev_set_10k.csv. Cached after first call."""
    try:
        df = pd.read_csv(DATA_PATH, low_memory=False)
    except Exception as exc:
        logger.error(f"company_stats: failed to load {DATA_PATH}: {exc}")
        return {}

    # Normalize column names (handle case variations)
    df.columns = [c.strip() for c in df.columns]
    company_col = next((c for c in df.columns if "company" in c.lower() and "response" not in c.lower()), None)
    response_col = next((c for c in df.columns if "company response" in c.lower()), None)
    product_col = next((c for c in df.columns if c.lower() == "product"), None)
    narrative_col = next((c for c in df.columns if "narrative" in c.lower()), None)
    timely_col = next((c for c in df.columns if "timely" in c.lower()), None)
    disputed_col = next((c for c in df.columns if "disputed" in c.lower()), None)

    if company_col is None:
        logger.error("company_stats: could not find Company column")
        return {}

    stats: dict[str, dict] = {}
    grouped = df.groupby(company_col)

    for company, group in grouped:
        total = len(group)
        if total < 5:
            continue  # skip companies with too few complaints

        resolved = 0
        if response_col:
            resolved = group[response_col].isin(_RESPONSE_POSITIVE).sum()

        timely = None
        if timely_col:
            timely_vals = group[timely_col].astype(str).str.strip().str.lower()
            timely_yes = (timely_vals == "yes").sum()
            timely = round(float(timely_yes) / total, 4) if total > 0 else None

        disputed = None
        if disputed_col:
            disputed_vals = group[disputed_col].astype(str).str.strip().str.lower()
            disputed_yes = (disputed_vals == "yes").sum()
            disputed = round(float(disputed_yes) / total, 4) if total > 0 else None

        avg_narrative_length = None
        if narrative_col:
            lengths = group[narrative_col].dropna().str.len()
            if len(lengths) > 0:
                avg_narrative_length = int(lengths.mean())

        # Top products for this company
        top_products: list[dict] = []
        if product_col:
            prod_counts = group[product_col].value_counts().head(5)
            top_products = [
                {"product": p, "count": int(c), "pct": round(float(c) / total, 4)}
                for p, c in prod_counts.items()
            ]

        stats[str(company)] = {
            "company": str(company),
            "total_complaints": total,
            "resolved_complaints": int(resolved),
            "resolution_rate": round(float(resolved) / total, 4) if total > 0 else 0.0,
            "timely_response_rate": timely,
            "consumer_dispute_rate": disputed,
            "avg_narrative_length": avg_narrative_length,
            "top_products": top_products,
        }

    logger.info(f"company_stats: loaded stats for {len(stats)} companies")
    return stats


_COMPANY_SUFFIXES = re.compile(
    r"\b(inc\.?|llc\.?|n\.a\.?|corp\.?|co\.?|bank|na|ltd\.?|plc|group|holdings?)\b\.?",
    re.IGNORECASE,
)


def _normalize_name(name: str) -> str:
    """Strip common legal suffixes and punctuation for fuzzy matching."""
    return _COMPANY_SUFFIXES.sub("", name).lower().strip(" ,.")


def get_company_stats(company_name: str) -> dict | None:
    """Return stats dict for a company, or None if not found.

    Performs case-insensitive and suffix-stripped fuzzy matching.
    """
    all_stats = _load_stats()
    if not all_stats:
        return None

    # Exact match first
    if company_name in all_stats:
        return all_stats[company_name]

    # Case-insensitive exact match
    lower = company_name.lower()
    for name, data in all_stats.items():
        if name.lower() == lower:
            return data

    # Substring match (company_name contained in stored name or vice versa)
    for name, data in all_stats.items():
        if lower in name.lower() or name.lower() in lower:
            return data

    # Suffix-stripped fuzzy match
    normalized_input = _normalize_name(company_name)
    if normalized_input:
        for name, data in all_stats.items():
            if _normalize_name(name) == normalized_input:
                return data
        for name, data in all_stats.items():
            norm = _normalize_name(name)
            if norm and (normalized_input in norm or norm in normalized_input):
                return data

    return None


def get_top_companies(n: int = 10) -> list[dict]:
    """Return top N companies by complaint count with their stats.

    Args:
        n: Number of companies to return (default 10).

    Returns:
        List of company stat dicts sorted by total_complaints descending.
    """
    all_stats = _load_stats()
    sorted_companies = sorted(
        all_stats.values(),
        key=lambda x: x["total_complaints"],
        reverse=True,
    )
    return sorted_companies[:n]


def get_all_company_names() -> list[str]:
    """Return sorted list of all company names with stats."""
    return sorted(_load_stats().keys())
