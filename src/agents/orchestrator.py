"""Orchestrator — wires agents into a LangGraph StateGraph pipeline."""
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, TypedDict

from langgraph.graph import END, StateGraph

from src.agents.causal_analyst import EventChainAgent
from src.agents.classifier import ClassifierAgent
from src.agents.quality_check import QualityCheckAgent
from src.agents.resolution import ResolutionAgent
from src.agents.risk_analyzer import RiskAnalyzerAgent
from src.agents.router import RouterAgent
from src.models.schemas import (
    CausalAnalysisOutput,
    ClassificationOutput,
    ComplaintInput,
    PipelineOutput,
    QualityCheckOutput,
    ResolutionOutput,
    RiskAnalysisOutput,
    RoutingOutput,
)

logger = logging.getLogger(__name__)


class PipelineState(TypedDict):
    complaint: ComplaintInput
    classification: Optional[ClassificationOutput]
    event_chain: Optional[CausalAnalysisOutput]
    risk_analysis: Optional[RiskAnalysisOutput]
    routing: Optional[RoutingOutput]
    resolution: Optional[ResolutionOutput]
    quality_check: Optional[QualityCheckOutput]
    timings: dict[str, float]


def _time_node(name: str, fn, state: PipelineState) -> PipelineState:
    """Run a node function and record elapsed time."""
    t0 = time.time()
    state = fn(state)
    elapsed = round(time.time() - t0, 2)
    state["timings"][name] = elapsed
    logger.info(f"[{name}] completed in {elapsed}s")
    print(f"[PIPELINE] {name}: {elapsed}s")
    return state


def _classify(state: PipelineState) -> PipelineState:
    agent = ClassifierAgent()
    state["classification"] = agent.run(state["complaint"])
    return state


def _risk_and_event_chain_parallel(state: PipelineState) -> PipelineState:
    """Run Risk Analyzer and Event Chain in parallel — they don't depend on each other."""
    complaint = state["complaint"]
    classification = state["classification"]

    with ThreadPoolExecutor(max_workers=2) as executor:
        risk_future = executor.submit(RiskAnalyzerAgent().run, complaint, classification)
        event_future = executor.submit(EventChainAgent().run, complaint, classification)
        state["risk_analysis"] = risk_future.result()
        state["event_chain"] = event_future.result()

    return state


def _route(state: PipelineState) -> PipelineState:
    agent = RouterAgent()
    state["routing"] = agent.run(
        state["complaint"],
        state["classification"],
        state["event_chain"],
        state["risk_analysis"],
    )
    return state


def _resolve(state: PipelineState) -> PipelineState:
    agent = ResolutionAgent()
    state["resolution"] = agent.run(
        state["complaint"],
        state["classification"],
        state["event_chain"],
        state["routing"],
        state["risk_analysis"],
    )
    return state


def _quality(state: PipelineState) -> PipelineState:
    agent = QualityCheckAgent()
    state["quality_check"] = agent.run(
        state["complaint"],
        state["classification"],
        state["event_chain"],
        state["routing"],
        state["resolution"],
        state["risk_analysis"],
    )
    return state


def _build_graph() -> StateGraph:
    graph = StateGraph(PipelineState)

    graph.add_node("classify", lambda s: _time_node("classify", _classify, s))
    graph.add_node(
        "risk_and_event_chain",
        lambda s: _time_node("risk_and_event_chain", _risk_and_event_chain_parallel, s),
    )
    graph.add_node("route", lambda s: _time_node("route", _route, s))
    graph.add_node("resolve", lambda s: _time_node("resolve", _resolve, s))
    graph.add_node("quality", lambda s: _time_node("quality", _quality, s))

    # Risk Analyzer and Event Chain run in parallel after Classify
    graph.set_entry_point("classify")
    graph.add_edge("classify", "risk_and_event_chain")
    graph.add_edge("risk_and_event_chain", "route")
    graph.add_edge("route", "resolve")
    graph.add_edge("resolve", "quality")
    graph.add_edge("quality", END)

    return graph.compile()


_GRAPH = None


def _get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = _build_graph()
    return _GRAPH


class Pipeline:
    """End-to-end complaint processing pipeline."""

    def run(self, complaint: ComplaintInput) -> PipelineOutput:
        """Process a single complaint through all agents. Returns PipelineOutput."""
        logger.info(f"Processing complaint {complaint.complaint_id}")
        _pipeline_start = time.time()
        print(f"\n[PIPELINE] === Starting pipeline for {complaint.complaint_id} ===")

        # Truncate narrative to 1500 chars for all agents (FIX 7c)
        if complaint.narrative and len(complaint.narrative) > 1500:
            from dataclasses import replace as _replace
            complaint = complaint.model_copy(update={"narrative": complaint.narrative[:1500]})

        initial_state: PipelineState = {
            "complaint": complaint,
            "classification": None,
            "event_chain": None,
            "risk_analysis": None,
            "routing": None,
            "resolution": None,
            "quality_check": None,
            "timings": {},
        }
        graph = _get_graph()
        final_state = graph.invoke(initial_state)

        total = round(time.time() - _pipeline_start, 2)
        logger.info(
            f"Pipeline complete for {complaint.complaint_id} in {total:.1f}s | "
            + " | ".join(f"{k}={v}s" for k, v in final_state["timings"].items())
        )
        print(f"[PIPELINE] === Total: {total}s ===\n")

        return PipelineOutput(
            complaint=final_state["complaint"],
            classification=final_state["classification"],
            event_chain=final_state["event_chain"],
            risk_analysis=final_state["risk_analysis"],
            routing=final_state["routing"],
            resolution=final_state["resolution"],
            quality_check=final_state["quality_check"],
        )

    def run_batch(self, complaints: list[ComplaintInput]) -> list[PipelineOutput]:
        """Process multiple complaints sequentially. Returns list of PipelineOutput."""
        results = []
        for i, complaint in enumerate(complaints):
            logger.info(f"Batch: processing {i + 1}/{len(complaints)}")
            results.append(self.run(complaint))
        return results
