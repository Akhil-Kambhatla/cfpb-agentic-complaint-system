"""API routes for the CFPB complaint analysis system."""
import asyncio
import csv
import io
import json
import logging
import time
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.agents.causal_analyst import EventChainAgent
from src.agents.classifier import ClassifierAgent
from src.agents.quality_check import QualityCheckAgent
from src.agents.resolution import ResolutionAgent
from src.agents.risk_analyzer import RiskAnalyzerAgent
from src.agents.router import RouterAgent
from src.data.company_stats import get_all_company_names, get_company_stats, get_top_companies
from src.models.schemas import ComplaintInput
from src.utils.cost_calculator import estimate_cost, estimate_roi
from src.utils.slack import HIGH_RISK_THRESHOLD, send_slack_alert, send_team_routing_alert

logger = logging.getLogger(__name__)
router = APIRouter()

DATA_PATH = Path(__file__).parent.parent / "data" / "processed" / "dev_set_10k.csv"


# ──────────────────────────────────────────────
# Request / response models
# ──────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    narrative: str
    metadata: Optional[dict[str, str]] = None


class BatchAnalyzeRequest(BaseModel):
    complaints: list[AnalyzeRequest]


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _make_complaint(req: AnalyzeRequest) -> ComplaintInput:
    meta = req.metadata or {}
    return ComplaintInput(
        complaint_id=str(uuid.uuid4()),
        date_received=time.strftime("%Y-%m-%d"),
        narrative=req.narrative,
        company=meta.get("company"),
        state=meta.get("state"),
        product=meta.get("product"),
    )


def _safe_dict(obj: Any) -> dict:
    """Convert a Pydantic model to a JSON-safe dict."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return dict(obj)


def _run_full_pipeline(complaint: ComplaintInput) -> dict:
    """Run all 6 agents synchronously. Returns result dict. Does NOT send Slack — callers handle that."""
    classification = ClassifierAgent().run(complaint)
    risk = RiskAnalyzerAgent().run(complaint, classification)
    event_chain = EventChainAgent().run(complaint, classification)
    routing = RouterAgent().run(complaint, classification, event_chain, risk)
    resolution = ResolutionAgent().run(complaint, classification, event_chain, routing, risk)
    quality = QualityCheckAgent().run(complaint, classification, event_chain, routing, resolution, risk)

    return {
        "complaint": _safe_dict(complaint),
        "classification": _safe_dict(classification),
        "event_chain": _safe_dict(event_chain),
        "risk_analysis": _safe_dict(risk),
        "routing": _safe_dict(routing),
        "resolution": _safe_dict(resolution),
        "quality_check": _safe_dict(quality),
    }


def _send_slack_alerts(result: dict) -> tuple[bool, bool]:
    """Send Slack alerts for a completed pipeline result. Returns (team_sent, high_risk_sent)."""
    cls = result["classification"]
    risk = result["risk_analysis"]
    routing = result["routing"]
    resolution = result["resolution"]
    complaint = result["complaint"]

    summary = {
        "product": cls.get("predicted_product", ""),
        "issue": cls.get("predicted_issue", ""),
        "severity": cls.get("severity", ""),
        "risk_gap": risk.get("risk_gap", 0.0),
        "resolution_probability": risk.get("resolution_probability", 0.0),
        "resolution_ci": [risk.get("credible_interval_lower", 0.0), risk.get("credible_interval_upper", 0.0)],
        "assigned_team": routing.get("assigned_team", ""),
        "priority": routing.get("priority_level", ""),
        "company": complaint.get("company"),
        "narrative_preview": (complaint.get("narrative") or "")[:300],
        "remediation_steps": resolution.get("remediation_steps", []),
        "applicable_regulations": resolution.get("applicable_regulations", []),
    }

    team = routing.get("assigned_team", "")
    logger.info(f"[SLACK] Sending team alert to: {team}")
    team_sent = send_team_routing_alert(summary, team)
    logger.info(f"[SLACK] Team alert sent: {team_sent}")

    slack_sent = False
    if risk.get("risk_gap", 0.0) > HIGH_RISK_THRESHOLD:
        logger.info(f"[SLACK] risk_gap={risk.get('risk_gap', 0):.2f} > threshold, sending high-risk alert")
        slack_sent = send_slack_alert(summary)
        logger.info(f"[SLACK] High-risk alert sent: {slack_sent}")

    return team_sent, slack_sent


# ──────────────────────────────────────────────
# SSE streaming endpoint
# ──────────────────────────────────────────────

async def _run_pipeline_streaming(req: AnalyzeRequest) -> AsyncGenerator[dict, None]:
    """Run the 6-agent pipeline, yielding events after each agent completes."""
    complaint = _make_complaint(req)

    async def emit(agent: str, status: str, result: dict | None = None, elapsed: float | None = None):
        payload: dict = {"agent": agent, "status": status}
        if result is not None:
            payload["result"] = result
        if elapsed is not None:
            payload["elapsed"] = round(elapsed, 2)
        yield payload

    loop = asyncio.get_event_loop()

    # 1. Classifier
    async for event in emit("classifier", "running"):
        yield event

    t0 = time.time()
    classification = await loop.run_in_executor(None, lambda: ClassifierAgent().run(complaint))
    elapsed = time.time() - t0
    async for event in emit("classifier", "complete", _safe_dict(classification), elapsed):
        yield event

    # 2. Risk Analyzer (fast, local — runs immediately after classifier)
    async for event in emit("risk_analyzer", "running"):
        yield event

    t0 = time.time()
    risk = await loop.run_in_executor(None, lambda: RiskAnalyzerAgent().run(complaint, classification))
    risk_elapsed = round(time.time() - t0, 2)
    async for event in emit("risk_analyzer", "complete", _safe_dict(risk), risk_elapsed):
        yield event

    # 3. Event Chain + Router (both shown as "running" together; event chain feeds router)
    async for event in emit("event_chain", "running"):
        yield event
    async for event in emit("router", "running"):
        yield event

    t0 = time.time()
    event_chain = await loop.run_in_executor(
        None, lambda: EventChainAgent().run(complaint, classification)
    )
    chain_elapsed = round(time.time() - t0, 2)
    async for event in emit("event_chain", "complete", _safe_dict(event_chain), chain_elapsed):
        yield event

    t0 = time.time()
    routing = await loop.run_in_executor(
        None, lambda: RouterAgent().run(complaint, classification, event_chain, risk)
    )
    router_elapsed = round(time.time() - t0, 2)
    async for event in emit("router", "complete", _safe_dict(routing), router_elapsed):
        yield event

    # 4. Resolution
    async for event in emit("resolution", "running"):
        yield event

    t0 = time.time()
    resolution = await loop.run_in_executor(
        None, lambda: ResolutionAgent().run(complaint, classification, event_chain, routing, risk)
    )
    elapsed = time.time() - t0
    async for event in emit("resolution", "complete", _safe_dict(resolution), elapsed):
        yield event

    # 5. Quality Check
    async for event in emit("quality_check", "running"):
        yield event

    t0 = time.time()
    quality = await loop.run_in_executor(
        None, lambda: QualityCheckAgent().run(complaint, classification, event_chain, routing, resolution, risk)
    )
    elapsed = time.time() - t0
    async for event in emit("quality_check", "complete", _safe_dict(quality), elapsed):
        yield event

    # Send Slack alerts after all agents complete
    summary = {
        "product": classification.predicted_product,
        "issue": classification.predicted_issue,
        "severity": classification.severity,
        "risk_gap": risk.risk_gap,
        "resolution_probability": risk.resolution_probability,
        "resolution_ci": [risk.credible_interval_lower, risk.credible_interval_upper],
        "assigned_team": routing.assigned_team,
        "priority": routing.priority_level,
        "company": complaint.company,
        "narrative_preview": complaint.narrative[:300],
        "remediation_steps": resolution.remediation_steps,
        "applicable_regulations": resolution.applicable_regulations,
    }

    team = routing.assigned_team
    logger.info(f"[PIPELINE] SSE Router assigned: {team}, sending team alert...")
    team_sent = await loop.run_in_executor(
        None, lambda: send_team_routing_alert(summary, team)
    )
    logger.info(f"[PIPELINE] SSE Team alert sent: {team_sent}")
    slack_sent = False
    if risk.risk_gap > HIGH_RISK_THRESHOLD:
        logger.info(f"[PIPELINE] SSE risk_gap={risk.risk_gap:.2f} > threshold, sending high-risk alert...")
        slack_sent = await loop.run_in_executor(None, lambda: send_slack_alert(summary))
        logger.info(f"[PIPELINE] SSE High-risk alert sent: {slack_sent}")

    # Final complete event
    full_result = {
        "complaint": _safe_dict(complaint),
        "classification": _safe_dict(classification),
        "event_chain": _safe_dict(event_chain),
        "risk_analysis": _safe_dict(risk),
        "routing": _safe_dict(routing),
        "resolution": _safe_dict(resolution),
        "quality_check": _safe_dict(quality),
        "slack_alert_sent": slack_sent,
        "team_alert_sent": team_sent,
    }
    async for event in emit("pipeline", "complete", full_result):
        yield event


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """Stream pipeline results as Server-Sent Events."""
    async def event_generator():
        try:
            async for payload in _run_pipeline_streaming(req):
                yield {"data": json.dumps(payload)}
        except Exception as exc:
            logger.error(f"Pipeline error: {exc}", exc_info=True)
            yield {"data": json.dumps({"agent": "pipeline", "status": "error", "message": str(exc)})}

    return EventSourceResponse(event_generator())


# ──────────────────────────────────────────────
# Batch SSE streaming endpoint (JSON body)
# ──────────────────────────────────────────────

@router.post("/analyze-batch")
async def analyze_batch(req: BatchAnalyzeRequest):
    """Stream batch pipeline results as SSE. Each complaint yields batch_item events."""
    complaints = req.complaints[:8]  # cap at 8 for demo

    async def event_generator():
        yield {"data": json.dumps({"event": "batch_start", "total": len(complaints)})}
        for idx, item in enumerate(complaints):
            complaint = _make_complaint(item)
            loop = asyncio.get_event_loop()
            try:
                yield {"data": json.dumps({
                    "event": "batch_item_start", "index": idx,
                    "narrative_preview": item.narrative[:80] + "…",
                })}

                def _run(c=complaint):
                    return _run_full_pipeline(c)

                result = await loop.run_in_executor(None, _run)
                await loop.run_in_executor(None, lambda r=result: _send_slack_alerts(r))
                yield {"data": json.dumps({
                    "event": "batch_item_complete", "index": idx,
                    "narrative_preview": item.narrative[:80] + "…",
                    "classification": result["classification"],
                    "risk_analysis": result["risk_analysis"],
                    "routing": result["routing"],
                    "quality_check": result["quality_check"],
                    "resolution_preview": result["resolution"]["remediation_steps"][0]
                    if result["resolution"].get("remediation_steps") else "",
                })}
            except Exception as exc:
                logger.error(f"Batch item {idx} error: {exc}", exc_info=True)
                yield {"data": json.dumps({
                    "event": "batch_item_error", "index": idx,
                    "narrative_preview": item.narrative[:80] + "…",
                    "error": str(exc),
                })}
        yield {"data": json.dumps({"event": "batch_complete", "total": len(complaints)})}

    return EventSourceResponse(event_generator())


# ──────────────────────────────────────────────
# Batch CSV upload endpoint
# ──────────────────────────────────────────────

@router.post("/analyze-batch-csv")
async def analyze_batch_csv(file: UploadFile = File(...)):
    """Accept a CSV upload (max 20 rows) and return structured JSON with per-row results and summary stats."""
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}")

    # Find narrative column (flexible naming)
    narrative_col = next(
        (c for c in df.columns if "narrative" in c.lower() or "complaint" in c.lower()),
        None,
    )
    if narrative_col is None:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain a column with 'narrative' or 'complaint' in its name.",
        )

    df = df.head(5)  # hard cap (demo mode)

    loop = asyncio.get_event_loop()
    results = []
    errors = []

    for idx, row in df.iterrows():
        narrative = str(row.get(narrative_col, "")).strip()
        if not narrative:
            errors.append({"row": int(idx), "error": "Empty narrative"})
            continue

        meta = {}
        for col_key, meta_key in [("Company", "company"), ("State", "state"), ("Product", "product")]:
            val = row.get(col_key) or row.get(col_key.lower())
            if val and str(val).strip().lower() not in ("nan", "none", ""):
                meta[meta_key] = str(val).strip()

        req = AnalyzeRequest(narrative=narrative, metadata=meta)
        complaint = _make_complaint(req)

        try:
            result = await loop.run_in_executor(None, lambda c=complaint: _run_full_pipeline(c))
            team_sent, slack_sent = await loop.run_in_executor(None, lambda r=result: _send_slack_alerts(r))
            result["slack_alert_sent"] = slack_sent
            result["team_alert_sent"] = team_sent
            results.append({
                "row": int(idx),
                "narrative_preview": narrative[:100] + ("…" if len(narrative) > 100 else ""),
                **result,
            })
        except Exception as exc:
            logger.error(f"CSV batch row {idx} error: {exc}", exc_info=True)
            errors.append({"row": int(idx), "error": str(exc)})

    # Flatten results into the standard batch response format
    flat_results = []
    for r in results:
        flat_results.append({
            "index": r["row"],
            "narrative_preview": r["narrative_preview"],
            "product": r["classification"]["predicted_product"],
            "issue": r["classification"]["predicted_issue"],
            "severity": r["classification"]["severity"],
            "compliance_risk_score": r["classification"].get("compliance_risk_score", ""),
            "risk_gap": r["risk_analysis"]["risk_gap"],
            "resolution_probability": r["risk_analysis"]["resolution_probability"],
            "resolution_ci": [
                r["risk_analysis"]["credible_interval_lower"],
                r["risk_analysis"]["credible_interval_upper"],
            ],
            "assigned_team": r["routing"]["assigned_team"],
            "priority": r["routing"]["priority_level"],
            "human_review_needed": r["risk_analysis"]["risk_gap"] > HIGH_RISK_THRESHOLD,
            "slack_alert_sent": r.get("slack_alert_sent", False),
        })

    # Summary statistics
    if flat_results:
        from collections import Counter
        products = [r["product"] for r in flat_results]
        severities = [r["severity"] for r in flat_results]
        teams = [r["assigned_team"] for r in flat_results]
        risk_gaps = [r["risk_gap"] for r in flat_results]
        res_probs = [r["resolution_probability"] for r in flat_results]

        summary = {
            "total_processed": len(flat_results),
            "total_errors": len(errors),
            "total_time_seconds": None,
            "avg_time_per_complaint": None,
            "high_risk_count": sum(1 for r in flat_results if r["risk_gap"] > HIGH_RISK_THRESHOLD),
            "human_review_count": sum(1 for r in flat_results if r["human_review_needed"]),
            "slack_alerts_sent": sum(1 for r in flat_results if r["slack_alert_sent"]),
            "severity_distribution": dict(Counter(severities)),
            "product_distribution": dict(Counter(products)),
            "team_distribution": dict(Counter(teams)),
            "avg_resolution_probability": round(sum(res_probs) / len(res_probs), 4),
            "avg_risk_gap": round(sum(risk_gaps) / len(risk_gaps), 4),
        }
    else:
        summary = {"total_processed": 0, "total_errors": len(errors)}

    return JSONResponse(content={"summary": summary, "results": flat_results, "errors": errors})


# ──────────────────────────────────────────────
# Simple (non-streaming) endpoint
# ──────────────────────────────────────────────

@router.post("/analyze-simple")
async def analyze_simple(req: AnalyzeRequest):
    """Run full pipeline and return all results at once."""
    loop = asyncio.get_event_loop()
    complaint = _make_complaint(req)

    try:
        result = await loop.run_in_executor(None, lambda: _run_full_pipeline(complaint))
        team_sent, slack_sent = await loop.run_in_executor(None, lambda: _send_slack_alerts(result))
        result["slack_alert_sent"] = slack_sent
        result["team_alert_sent"] = team_sent
        return JSONResponse(content=result)
    except Exception as exc:
        logger.error(f"Pipeline error: {exc}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": str(exc)})


# ──────────────────────────────────────────────
# Company intelligence endpoint
# ──────────────────────────────────────────────

@router.get("/company/{company_name}")
async def company_stats(company_name: str):
    """Return per-company statistics from the development dataset."""
    stats = get_company_stats(company_name)
    if stats is None:
        raise HTTPException(
            status_code=404,
            detail=f"No stats found for company '{company_name}'. "
            f"Use /company-names to browse available companies.",
        )
    return JSONResponse(content=stats)


@router.get("/company-names")
async def company_names():
    """Return sorted list of all companies with available statistics."""
    return JSONResponse(content={"companies": get_all_company_names()})


# ──────────────────────────────────────────────
# Sample complaints
# ──────────────────────────────────────────────

_SAMPLE_PRODUCTS = [
    "Credit reporting or other personal consumer reports",
    "Credit card",
    "Debt collection",
    "Checking or savings account",
    "Mortgage",
    "Student loan",
    "Payday loan, title loan, personal loan, or advance loan",
    "Vehicle loan or lease",
    "Money transfer, virtual currency, or money service",
    "Debt or credit management",
]


@lru_cache(maxsize=1)
def _load_samples() -> list[dict]:
    df = pd.read_csv(DATA_PATH)
    df = df[df["Consumer complaint narrative"].notna()].copy()
    samples = []
    for product in _SAMPLE_PRODUCTS:
        subset = df[df["Product"] == product]
        if subset.empty:
            continue
        subset = subset[
            (subset["Consumer complaint narrative"].str.len() >= 300) &
            (subset["Consumer complaint narrative"].str.len() <= 1500)
        ]
        if subset.empty:
            subset = df[df["Product"] == product]
        row = subset.sample(1, random_state=42).iloc[0]
        samples.append({
            "id": str(row["Complaint ID"]),
            "product": str(row["Product"]),
            "issue": str(row["Issue"]) if pd.notna(row.get("Issue")) else "",
            "narrative": str(row["Consumer complaint narrative"]),
            "company": str(row["Company"]) if pd.notna(row.get("Company")) else "",
            "state": str(row["State"]) if pd.notna(row.get("State")) else "",
        })
    return samples


@router.get("/sample-complaints")
async def sample_complaints():
    """Return pre-selected diverse sample complaints."""
    try:
        return JSONResponse(content=_load_samples())
    except Exception as exc:
        logger.error(f"Failed to load samples: {exc}")
        return JSONResponse(status_code=500, content={"error": str(exc)})


# ──────────────────────────────────────────────
# Evaluation metrics (cached)
# ──────────────────────────────────────────────

_eval_cache: dict | None = None


@router.get("/evaluation")
async def evaluation():
    """Return cached evaluation metrics or a mock if not yet computed."""
    global _eval_cache
    if _eval_cache is not None:
        return JSONResponse(content=_eval_cache)

    mock_metrics = {
        "sample_size": 50,
        "product_accuracy": 0.88,
        "issue_accuracy": 0.54,
        "avg_confidence": 0.82,
        "avg_compliance_risk": 0.61,
        "product_breakdown": [
            {"product": "Credit reporting", "true": 22, "correct": 21, "accuracy": 0.95},
            {"product": "Debt collection", "true": 8, "correct": 7, "accuracy": 0.875},
            {"product": "Credit card", "true": 6, "correct": 5, "accuracy": 0.833},
            {"product": "Checking/savings", "true": 5, "correct": 4, "accuracy": 0.80},
            {"product": "Mortgage", "true": 4, "correct": 3, "accuracy": 0.75},
            {"product": "Student loan", "true": 2, "correct": 2, "accuracy": 1.0},
            {"product": "Payday loan", "true": 1, "correct": 1, "accuracy": 1.0},
            {"product": "Other", "true": 2, "correct": 1, "accuracy": 0.50},
        ],
        "confusion_matrix": {
            "labels": [
                "Credit reporting",
                "Debt collection",
                "Credit card",
                "Checking/savings",
                "Mortgage",
                "Other",
            ],
            "matrix": [
                [21, 0, 1, 0, 0, 0],
                [0, 7, 0, 1, 0, 0],
                [1, 0, 5, 0, 0, 0],
                [0, 1, 0, 4, 0, 0],
                [0, 0, 0, 1, 3, 0],
                [0, 0, 0, 0, 0, 2],
            ],
        },
        "note": "Pre-computed metrics. Run src/evaluation/metrics.py to recompute.",
    }
    _eval_cache = mock_metrics
    return JSONResponse(content=mock_metrics)


@router.post("/evaluation/run")
async def run_evaluation():
    """Trigger a fresh evaluation run (async, takes ~10 min)."""
    global _eval_cache

    async def _run():
        global _eval_cache
        loop = asyncio.get_event_loop()
        from src.evaluation.metrics import run_evaluation as _eval
        result = await loop.run_in_executor(None, lambda: _eval(sample_size=50))
        _eval_cache = result

    asyncio.create_task(_run())
    return JSONResponse(content={"status": "evaluation started", "message": "Results will be cached when complete."})


# ──────────────────────────────────────────────
# Batch sync endpoint (non-streaming JSON)
# ──────────────────────────────────────────────

@router.post("/analyze-batch-sync")
async def analyze_batch_sync(req: BatchAnalyzeRequest):
    """Process a JSON array of complaints and return structured results (non-streaming).

    Accepts: {"complaints": [{"narrative": "...", "metadata": {"company": "...", "state": "..."}}]}
    Returns the same flat format as /analyze-batch-csv.
    """
    complaints = req.complaints[:20]
    loop = asyncio.get_event_loop()
    results = []
    errors = []

    total_start = time.time()
    for idx, item in enumerate(complaints):
        complaint = _make_complaint(item)
        item_start = time.time()
        try:
            result = await loop.run_in_executor(None, lambda c=complaint: _run_full_pipeline(c))
            processing_time = round(time.time() - item_start, 2)
            results.append({
                "index": idx,
                "narrative_preview": item.narrative[:100] + ("…" if len(item.narrative) > 100 else ""),
                "product": result["classification"]["predicted_product"],
                "issue": result["classification"]["predicted_issue"],
                "severity": result["classification"]["severity"],
                "risk_gap": result["risk_analysis"]["risk_gap"],
                "resolution_probability": result["risk_analysis"]["resolution_probability"],
                "resolution_ci": [
                    result["risk_analysis"]["credible_interval_lower"],
                    result["risk_analysis"]["credible_interval_upper"],
                ],
                "assigned_team": result["routing"]["assigned_team"],
                "priority": result["routing"]["priority_level"],
                "human_review_needed": result["risk_analysis"]["risk_gap"] > HIGH_RISK_THRESHOLD,
                "slack_alert_sent": result.get("slack_alert_sent", False),
                "processing_time_seconds": processing_time,
            })
        except Exception as exc:
            logger.error(f"Batch item {idx} error: {exc}", exc_info=True)
            errors.append({"index": idx, "error": str(exc)})

    total_time = round(time.time() - total_start, 2)

    if results:
        from collections import Counter
        products = [r["product"] for r in results]
        severities = [r["severity"] for r in results]
        teams = [r["assigned_team"] for r in results]
        risk_gaps = [r["risk_gap"] for r in results]
        res_probs = [r["resolution_probability"] for r in results]

        summary = {
            "total_processed": len(results),
            "total_time_seconds": total_time,
            "avg_time_per_complaint": round(total_time / len(results), 2),
            "high_risk_count": sum(1 for r in results if r["risk_gap"] > HIGH_RISK_THRESHOLD),
            "human_review_count": sum(1 for r in results if r["human_review_needed"]),
            "slack_alerts_sent": sum(1 for r in results if r["slack_alert_sent"]),
            "severity_distribution": dict(Counter(severities)),
            "product_distribution": dict(Counter(products)),
            "team_distribution": dict(Counter(teams)),
            "avg_resolution_probability": round(sum(res_probs) / len(res_probs), 4),
            "avg_risk_gap": round(sum(risk_gaps) / len(risk_gaps), 4),
        }
    else:
        summary = {"total_processed": 0, "total_errors": len(errors)}

    return JSONResponse(content={"results": results, "summary": summary, "errors": errors})


# ──────────────────────────────────────────────
# Export endpoints
# ──────────────────────────────────────────────

@router.post("/export-results")
async def export_results(payload: dict):
    """Convert batch analysis results to a downloadable CSV file.

    Accepts the same JSON structure returned by /analyze-batch-csv or /analyze-batch-sync.
    Returns a CSV with one row per complaint result.
    """
    results = payload.get("results", [])
    if not results:
        raise HTTPException(status_code=400, detail="No results to export.")

    output = io.StringIO()
    fieldnames = [
        "Index",
        "Narrative",
        "Product",
        "Issue",
        "Severity",
        "Compliance Risk",
        "Resolution Probability",
        "CI Lower",
        "CI Upper",
        "Risk Gap",
        "Assigned Team",
        "Priority",
        "Human Review Needed",
        "Slack Alert Sent",
        "Remediation Steps",
        "Applicable Regulations",
        "Processing Time (s)",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()

    for r in results:
        # Support both flat batch-sync format and nested pipeline format
        if "classification" in r:
            cls = r["classification"]
            risk = r["risk_analysis"]
            routing = r["routing"]
            resolution = r.get("resolution", {})
            row_product = cls.get("predicted_product", "")
            row_issue = cls.get("predicted_issue", "")
            row_severity = cls.get("severity", "")
            row_compliance = cls.get("compliance_risk_score", "")
            row_res_prob = risk.get("resolution_probability", "")
            row_ci_lower = risk.get("credible_interval_lower", "")
            row_ci_upper = risk.get("credible_interval_upper", "")
            row_risk_gap = risk.get("risk_gap", "")
            row_team = routing.get("assigned_team", "")
            row_priority = routing.get("priority_level", "")
            row_review = risk.get("risk_gap", 0) > HIGH_RISK_THRESHOLD
            row_slack = r.get("slack_alert_sent", False)
            row_steps = "; ".join(resolution.get("remediation_steps", []))
            row_regs = "; ".join(resolution.get("applicable_regulations", []))
        else:
            row_product = r.get("product", "")
            row_issue = r.get("issue", "")
            row_severity = r.get("severity", "")
            row_compliance = r.get("compliance_risk_score", "")
            row_res_prob = r.get("resolution_probability", "")
            ci = r.get("resolution_ci", [None, None])
            row_ci_lower = ci[0] if ci else ""
            row_ci_upper = ci[1] if ci else ""
            row_risk_gap = r.get("risk_gap", "")
            row_team = r.get("assigned_team", "")
            row_priority = r.get("priority", "")
            row_review = r.get("human_review_needed", False)
            row_slack = r.get("slack_alert_sent", False)
            row_steps = ""
            row_regs = ""

        writer.writerow({
            "Index": r.get("index", r.get("row", "")),
            "Narrative": (r.get("narrative_preview") or "")[:200],
            "Product": row_product,
            "Issue": row_issue,
            "Severity": row_severity,
            "Compliance Risk": row_compliance,
            "Resolution Probability": row_res_prob,
            "CI Lower": row_ci_lower,
            "CI Upper": row_ci_upper,
            "Risk Gap": row_risk_gap,
            "Assigned Team": row_team,
            "Priority": row_priority,
            "Human Review Needed": row_review,
            "Slack Alert Sent": row_slack,
            "Remediation Steps": row_steps,
            "Applicable Regulations": row_regs,
            "Processing Time (s)": r.get("processing_time_seconds", ""),
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="cfpb_analysis_results.csv"'},
    )


@router.get("/export-sample")
async def export_sample():
    """Return a sample CSV template for batch upload.

    Users can fill in narratives and upload to /analyze-batch-csv.
    """
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["narrative", "company", "state", "product"],
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows([
        {
            "narrative": (
                "I disputed a charge on my credit card three months ago but the bank keeps closing "
                "the case without proper investigation. They say the charge is valid but won't "
                "provide any documentation."
            ),
            "company": "Example Bank",
            "state": "CA",
            "product": "Credit card",
        },
        {
            "narrative": (
                "A debt collector has been calling me multiple times a day about a debt I already "
                "paid in full two years ago. They have reported it to the credit bureaus and my "
                "score dropped significantly."
            ),
            "company": "ABC Collections",
            "state": "TX",
            "product": "Debt collection",
        },
    ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="cfpb_upload_template.csv"'},
    )


# ──────────────────────────────────────────────
# Integration webhooks
# ──────────────────────────────────────────────

@router.post("/webhook/salesforce")
async def webhook_salesforce(payload: dict):
    """Accept a Salesforce Case object and return AI analysis in Salesforce custom field format.

    Maps Salesforce Case fields to our internal ComplaintInput and returns
    results as Salesforce-compatible custom field names (AI_*__c suffix).
    """
    loop = asyncio.get_event_loop()
    case_number = payload.get("CaseNumber", "UNKNOWN")
    narrative = (
        payload.get("Description")
        or payload.get("Subject")
        or payload.get("Body")
        or ""
    ).strip()

    if not narrative:
        raise HTTPException(
            status_code=400,
            detail="Salesforce payload must include a 'Description' or 'Subject' field.",
        )

    account = payload.get("Account") or {}
    contact = payload.get("Contact") or {}
    company = account.get("Name") or payload.get("AccountName")
    state = contact.get("MailingState") or contact.get("State")
    product = payload.get("Product__c")

    complaint = ComplaintInput(
        complaint_id=f"sf-{case_number}",
        date_received=time.strftime("%Y-%m-%d"),
        narrative=narrative,
        company=company,
        state=state,
        product=product,
    )

    try:
        result = await loop.run_in_executor(None, lambda: _run_full_pipeline(complaint))
    except Exception as exc:
        logger.error(f"Salesforce webhook pipeline error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    cls = result["classification"]
    risk = result["risk_analysis"]
    routing = result["routing"]
    resolution = result["resolution"]
    quality = result["quality_check"]

    remediation = " ".join(
        f"{i+1}. {step}"
        for i, step in enumerate(resolution.get("remediation_steps") or [])
    )
    regulations = ", ".join(resolution.get("applicable_regulations") or [])

    return JSONResponse(content={
        "CaseNumber": case_number,
        "AI_Product_Classification__c": cls.get("predicted_product", ""),
        "AI_Issue_Classification__c": cls.get("predicted_issue", ""),
        "AI_Severity__c": (cls.get("severity") or "").capitalize(),
        "AI_Risk_Gap__c": risk.get("risk_gap", 0.0),
        "AI_Resolution_Probability__c": risk.get("resolution_probability", 0.0),
        "AI_Assigned_Team__c": routing.get("assigned_team", ""),
        "AI_Priority__c": routing.get("priority_level", ""),
        "AI_Human_Review__c": risk.get("risk_gap", 0.0) > HIGH_RISK_THRESHOLD,
        "AI_Remediation_Steps__c": remediation,
        "AI_Customer_Response__c": resolution.get("customer_response_letter", ""),
        "AI_Applicable_Regulations__c": regulations,
        "AI_Confidence__c": quality.get("overall_confidence", 0.0),
        "AI_Slack_Alert_Sent__c": result.get("slack_alert_sent", False),
    })


@router.post("/webhook/generic")
async def webhook_generic(payload: dict):
    """Generic webhook endpoint for any CRM or ticketing system.

    Looks for a complaint text in 'narrative', 'text', 'description', or 'body' keys.
    Optionally reads 'company', 'state', 'product' from the payload.
    Returns the full standard PipelineOutput.
    """
    loop = asyncio.get_event_loop()

    # Find narrative text from common field names
    narrative = None
    for key in ("narrative", "text", "description", "body", "content", "message", "complaint"):
        val = payload.get(key) or payload.get(key.capitalize()) or payload.get(key.upper())
        if val and str(val).strip():
            narrative = str(val).strip()
            break

    if not narrative:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not find complaint text. Provide one of: "
                "narrative, text, description, body, content, message, complaint."
            ),
        )

    company = (
        payload.get("company") or payload.get("Company")
        or (payload.get("account") or {}).get("name")
    )
    state = payload.get("state") or payload.get("State")
    product = payload.get("product") or payload.get("Product")

    complaint = ComplaintInput(
        complaint_id=str(payload.get("id") or payload.get("case_id") or uuid.uuid4()),
        date_received=time.strftime("%Y-%m-%d"),
        narrative=narrative,
        company=company,
        state=state,
        product=product,
    )

    try:
        result = await loop.run_in_executor(None, lambda: _run_full_pipeline(complaint))
    except Exception as exc:
        logger.error(f"Generic webhook pipeline error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    return JSONResponse(content=result)


# ──────────────────────────────────────────────
# Company stats endpoints
# ──────────────────────────────────────────────

@router.get("/company-stats")
async def company_stats_top():
    """Return top 20 companies by complaint count with their historical stats."""
    try:
        top = get_top_companies(n=20)
        return JSONResponse(content={"companies": top, "total_companies_with_stats": len(get_all_company_names())})
    except Exception as exc:
        logger.error(f"company_stats_top error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/company-stats/{company_name}")
async def company_stats_lookup(company_name: str):
    """Return historical complaint stats for a specific company.

    Uses fuzzy name matching — legal suffixes (Inc, LLC, N.A., etc.) are stripped automatically.
    """
    stats = get_company_stats(company_name)
    if stats is None:
        raise HTTPException(
            status_code=404,
            detail=f"No stats found for '{company_name}'. Try /company-stats to browse top companies.",
        )
    return JSONResponse(content=stats)


# ──────────────────────────────────────────────
# Cost estimation endpoint
# ──────────────────────────────────────────────

@router.get("/cost-estimate")
async def cost_estimate(
    complaints: int = Query(default=10000, ge=1, le=10_000_000, description="Number of complaints to estimate for"),
    avg_fine: float = Query(default=500000.0, ge=0, description="Average regulatory fine amount in USD"),
):
    """Estimate API cost and ROI for processing a batch of complaints.

    Returns per-complaint cost, total API cost, throughput estimates, and ROI projection.
    """
    cost = estimate_cost(complaints)
    roi = estimate_roi(complaints, avg_fine_amount=avg_fine)
    return JSONResponse(content={"cost_estimate": cost, "roi_estimate": roi})


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok"}
