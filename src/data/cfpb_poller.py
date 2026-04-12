"""Polls the CFPB Consumer Complaint Database API for new complaints."""
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests

from src.data.database import (
    get_processed_complaint_ids,
    get_recent_complaints,
    get_system_state,
    set_system_state,
)

logger = logging.getLogger(__name__)

CFPB_API_URL = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/"

_HEADERS = {
    "User-Agent": "CFPB-Complaint-Intelligence-System/1.0 (UMD Research Project; Educational Use)",
    "Accept": "application/json",
}

_HEADERS_ALT = {
    "User-Agent": "Mozilla/5.0 (compatible; CFPBResearch/1.0; +https://github.com/umd-cfpb-research)",
    "Accept": "application/json",
}


def _fetch_from_api(params: dict, headers: dict) -> list[dict]:
    """Raw API call. Returns list of complaint dicts."""
    try:
        resp = requests.get(CFPB_API_URL, params=params, headers=headers, timeout=15)
        if resp.status_code == 403:
            raise PermissionError("403 from CFPB API")
        resp.raise_for_status()
        data = resp.json()
        hits = data.get("hits", {}).get("hits", [])
        return [h.get("_source", {}) for h in hits]
    except PermissionError:
        raise
    except Exception as exc:
        logger.error("CFPB API error: %s", exc)
        return []


def _normalize(raw: dict) -> dict:
    """Map CFPB API fields to our ComplaintInput-compatible dict."""
    return {
        "complaint_id": str(raw.get("complaint_id", "")),
        "date_received": raw.get("date_received", datetime.utcnow().strftime("%Y-%m-%d")),
        "narrative": raw.get("complaint_what_happened", ""),
        "product": raw.get("product", ""),
        "sub_product": raw.get("sub_product", ""),
        "issue": raw.get("issue", ""),
        "sub_issue": raw.get("sub_issue", ""),
        "company": raw.get("company", ""),
        "state": raw.get("state", ""),
        "zip_code": raw.get("zip_code", ""),
        "company_response_to_consumer": raw.get("company_response", ""),
    }


def fetch_recent_complaints(since_date: str, max_results: int = 25) -> list[dict]:
    """
    Fetch complaints from the CFPB API since a given date.

    Returns a clean list of dicts matching our ComplaintInput format.
    Deduplicates against already-processed complaint IDs in the database.
    """
    params = {
        "has_narrative": "true",
        "date_received_min": since_date,
        "size": min(max_results, 25),
        "sort": "created_date_desc",
        "no_aggs": "true",
    }

    raw_hits = []
    try:
        raw_hits = _fetch_from_api(params, _HEADERS)
    except PermissionError:
        logger.warning("CFPB API returned 403 — retrying with alternate User-Agent")
        try:
            raw_hits = _fetch_from_api(params, _HEADERS_ALT)
        except PermissionError:
            logger.error("CFPB API still returning 403 after retry — skipping poll")
            return []

    if not raw_hits:
        logger.info("No complaints returned from CFPB API")
        return []

    # Deduplicate against already-processed IDs
    recent = get_recent_complaints(hours=24 * 30, limit=500)  # last 30 days
    processed_ids = {r["complaint_id"] for r in recent if r.get("complaint_id")}

    complaints = []
    for raw in raw_hits:
        normalized = _normalize(raw)
        cid = normalized["complaint_id"]
        if not normalized["narrative"]:
            continue
        if cid and cid in processed_ids:
            logger.debug("Skipping already-processed complaint %s", cid)
            continue
        complaints.append(normalized)

    logger.info("Fetched %d new complaints from CFPB API (since %s)", len(complaints), since_date)
    return complaints


def fetch_new_since_last_poll() -> list[dict]:
    """
    Fetch recent CFPB complaints we haven't processed yet.

    Always looks back 30 days to account for the CFPB API's 2-3 week publishing delay.
    Deduplicates against all complaint IDs already in the database.
    Updates last_poll_time in system_state.
    """
    # Always look back 30 days — CFPB data has a 2-3 week publishing delay
    since_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    logger.info("Polling CFPB API for complaints since %s (30-day window)", since_date)

    params = {
        "has_narrative": "true",
        "date_received_min": since_date,
        "size": 25,
        "sort": "created_date_desc",
        "no_aggs": "true",
    }

    raw_hits = []
    try:
        raw_hits = _fetch_from_api(params, _HEADERS)
    except PermissionError:
        logger.warning("CFPB API returned 403 — retrying with alternate User-Agent")
        try:
            raw_hits = _fetch_from_api(params, _HEADERS_ALT)
        except PermissionError:
            logger.error("CFPB API still returning 403 after retry — skipping poll")
            return []

    if not raw_hits:
        logger.info("No complaints returned from CFPB API")
        set_system_state("last_poll_time", datetime.utcnow().isoformat())
        return []

    # Use the full processed_complaints table for deduplication (not just recent 30 days)
    processed_ids = get_processed_complaint_ids()

    complaints = []
    for raw in raw_hits:
        normalized = _normalize(raw)
        cid = normalized["complaint_id"]
        if not normalized["narrative"]:
            continue
        if cid and cid in processed_ids:
            logger.debug("Skipping already-processed complaint %s", cid)
            continue
        complaints.append(normalized)

    # Update last poll time
    set_system_state("last_poll_time", datetime.utcnow().isoformat())

    if not complaints:
        logger.info("No new complaints in the last 30 days (all already processed)")
    else:
        logger.info("Fetched %d new complaints from CFPB API", len(complaints))

    return complaints


def fetch_structured_only_complaints(max_results: int = 5) -> list[dict]:
    """
    Fetch recent complaints that don't have narratives — structured data only.

    These use CFPB's own classification (product/issue) rather than our LLM classifier.
    Returns complaint dicts with an empty narrative field.
    """
    since_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    params = {
        "has_narrative": "false",
        "date_received_min": since_date,
        "size": max_results * 3,  # fetch extra to account for duplicates
        "sort": "created_date_desc",
        "no_aggs": "true",
    }

    raw_hits = []
    try:
        raw_hits = _fetch_from_api(params, _HEADERS)
    except PermissionError:
        try:
            raw_hits = _fetch_from_api(params, _HEADERS_ALT)
        except PermissionError:
            logger.error("CFPB API 403 when fetching structured-only complaints")
            return []

    if not raw_hits:
        return []

    processed_ids = get_processed_complaint_ids()

    complaints = []
    for raw in raw_hits:
        normalized = _normalize(raw)
        cid = normalized["complaint_id"]
        if cid and cid in processed_ids:
            continue
        # Mark as structured-only (no narrative)
        normalized["narrative"] = ""
        normalized["source"] = "cfpb_api_structured"
        complaints.append(normalized)
        if len(complaints) >= max_results:
            break

    logger.info("Fetched %d structured-only complaints from CFPB API", len(complaints))
    return complaints
