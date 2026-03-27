"""Pydantic models defining the data contracts between all agents."""
from typing import Optional
from pydantic import BaseModel, Field


class ComplaintInput(BaseModel):
    """Raw complaint input to the system."""
    complaint_id: str
    date_received: str
    product: Optional[str] = None
    sub_product: Optional[str] = None
    issue: Optional[str] = None
    sub_issue: Optional[str] = None
    narrative: str = Field(description="The consumer complaint narrative text")
    company: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None


class ClassificationOutput(BaseModel):
    """Output from the Classifier Agent."""
    predicted_product: str
    predicted_sub_product: Optional[str] = None
    predicted_issue: str
    predicted_sub_issue: Optional[str] = None
    severity: str = Field(description="low, medium, high, or critical")
    compliance_risk_score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class CausalEdge(BaseModel):
    """A single causal relationship in the DAG."""
    cause: str
    effect: str
    description: str


class CausalAnalysisOutput(BaseModel):
    """Output from the Causal Analyst Agent."""
    causal_chain: list[CausalEdge]
    root_cause: str
    causal_depth: int = Field(description="Number of hops from root cause to complaint")
    counterfactual_intervention: str = Field(
        description="What would have had to be different to prevent this complaint"
    )
    prevention_recommendation: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class RoutingOutput(BaseModel):
    """Output from the Router Agent."""
    assigned_team: str
    priority_level: str = Field(description="P1, P2, P3, or P4")
    escalation_flag: bool = False
    escalation_reason: Optional[str] = None
    reasoning: str


class ResolutionOutput(BaseModel):
    """Output from the Resolution Agent."""
    remediation_steps: list[str]
    customer_response_letter: str
    preventive_recommendations: list[str]
    applicable_regulations: list[str]
    estimated_resolution_days: int
    reasoning: str


class QualityCheckOutput(BaseModel):
    """Output from the Quality + Explainability Agent."""
    overall_confidence: float = Field(ge=0.0, le=1.0)
    quality_flag: str = Field(description="pass, review, or fail")
    consistency_issues: list[str]
    reasoning_trace: str
    agent_confidences: dict[str, float]


class PipelineOutput(BaseModel):
    """Complete output from the entire pipeline."""
    complaint: ComplaintInput
    classification: ClassificationOutput
    causal_analysis: CausalAnalysisOutput
    routing: RoutingOutput
    resolution: ResolutionOutput
    quality_check: QualityCheckOutput
