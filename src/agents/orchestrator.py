"""Orchestrator — wires agents into a LangGraph StateGraph pipeline."""
import logging
import time
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
    state["timings"][name] = round(time.time() - t0, 2)
    logger.info(f"[{name}] completed in {state['timings'][name]}s")
    return state


def _classify(state: PipelineState) -> PipelineState:
    agent = ClassifierAgent()
    state["classification"] = agent.run(state["complaint"])
    return state


def _event_chain(state: PipelineState) -> PipelineState:
    agent = EventChainAgent()
    state["event_chain"] = agent.run(state["complaint"], state["classification"])
    return state


def _risk(state: PipelineState) -> PipelineState:
    agent = RiskAnalyzerAgent()
    state["risk_analysis"] = agent.run(state["complaint"], state["classification"])
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
    graph.add_node("event_chain", lambda s: _time_node("event_chain", _event_chain, s))
    graph.add_node("risk", lambda s: _time_node("risk", _risk, s))
    graph.add_node("route", lambda s: _time_node("route", _route, s))
    graph.add_node("resolve", lambda s: _time_node("resolve", _resolve, s))
    graph.add_node("quality", lambda s: _time_node("quality", _quality, s))

    # Event chain and risk analyzer run sequentially after classify
    # (risk is fast/local; event_chain feeds into router)
    graph.set_entry_point("classify")
    graph.add_edge("classify", "risk")
    graph.add_edge("risk", "event_chain")
    graph.add_edge("event_chain", "route")
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

        total = sum(final_state["timings"].values())
        logger.info(
            f"Pipeline complete for {complaint.complaint_id} in {total:.1f}s | "
            + " | ".join(f"{k}={v}s" for k, v in final_state["timings"].items())
        )

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
