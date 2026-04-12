// TypeScript types matching the Python Pydantic schemas

export interface ComplaintInput {
  complaint_id: string;
  date_received: string;
  product?: string;
  sub_product?: string;
  issue?: string;
  sub_issue?: string;
  narrative: string;
  company?: string;
  state?: string;
  zip_code?: string;
}

export interface ClassificationOutput {
  predicted_product: string;
  predicted_sub_product?: string;
  predicted_issue: string;
  predicted_sub_issue?: string;
  severity: "low" | "medium" | "high" | "critical";
  compliance_risk_score: number;
  confidence: number;
  reasoning: string;
}

export interface CausalEdge {
  cause: string;
  effect: string;
  description: string;
}

export interface CausalAnalysisOutput {
  causal_chain: CausalEdge[];
  root_cause: string;
  causal_depth: number;
  counterfactual_intervention: string;
  prevention_recommendation: string;
  confidence: number;
  reasoning: string;
}

export interface RiskAnalysisOutput {
  resolution_probability: number;
  credible_interval_lower: number;
  credible_interval_upper: number;
  risk_gap: number;
  regulatory_risk: number;
  intervention_effect: number;
  company_baseline: number;
  company_resolution_rate?: number | null;
  posterior_std: number;
  feature_contributions: Record<string, number>;
  risk_level: "low" | "medium" | "high" | "critical";
  recommended_action: string;
  confidence: number;
  reasoning: string;
}

export interface RoutingOutput {
  assigned_team: string;
  priority_level: "P1" | "P2" | "P3" | "P4";
  escalation_flag: boolean;
  escalation_reason?: string;
  reasoning: string;
}

export interface ResolutionOutput {
  remediation_steps: string[];
  customer_response_letter: string;
  preventive_recommendations: string[];
  preventive_recommendation?: string | null;
  applicable_regulations: string[];
  estimated_resolution_days: number;
  reasoning: string;
}

export interface SatisfactionPrediction {
  predicted_score: number;
  confidence_range: [number, number];
  factors: Record<string, string>;
  recommendation: string;
}

export interface QualityCheckOutput {
  overall_confidence: number;
  quality_flag: "pass" | "review" | "fail";
  consistency_issues: string[];
  reasoning_trace: string;
  agent_confidences: Record<string, number>;
}

export interface PipelineOutput {
  complaint: ComplaintInput;
  classification: ClassificationOutput;
  event_chain: CausalAnalysisOutput;
  risk_analysis: RiskAnalysisOutput;
  routing: RoutingOutput;
  resolution: ResolutionOutput;
  quality_check: QualityCheckOutput;
  slack_alert_sent?: boolean;
  team_alert_sent?: boolean;
  predicted_satisfaction?: SatisfactionPrediction | null;
}

export type AgentName =
  | "classifier"
  | "risk_analyzer"
  | "event_chain"
  | "router"
  | "resolution"
  | "quality_check"
  | "pipeline";

export type AgentStatus = "idle" | "running" | "complete" | "error";

export interface AgentEvent {
  agent: AgentName;
  status: "running" | "complete" | "error";
  result?: unknown;
  elapsed?: number;
  message?: string;
}

export interface AgentState {
  status: AgentStatus;
  elapsed?: number;
  result?: unknown;
}

export interface SampleComplaint {
  id: string;
  product: string;
  issue: string;
  narrative: string;
  company: string;
  state: string;
}

export interface ProductBreakdown {
  product: string;
  true: number;
  correct: number;
  accuracy: number;
}

export interface ConfusionMatrix {
  labels: string[];
  matrix: number[][];
}

export interface EvaluationMetrics {
  sample_size: number;
  product_accuracy: number;
  issue_accuracy: number;
  avg_confidence: number;
  avg_compliance_risk: number;
  product_breakdown: ProductBreakdown[];
  confusion_matrix: ConfusionMatrix;
  note?: string;
}
