# CFPB Agentic Complaint Categorization System

> 2026 UMD Agentic AI Challenge — Robert H. Smith School of Business

A multi-agent AI system that processes consumer financial complaints using causal counterfactual analysis to not just classify complaints, but explain *why they happen* and *how to prevent them*.

## Problem

Financial service companies receive thousands of complaints that are inconsistently categorized, manually routed, and often delayed. This increases regulatory risk and customer churn.

## Our Approach

We built a **5-agent orchestrated pipeline** using LangGraph that goes beyond classification:

1. **Classifier Agent** — Categorizes by product, issue, severity, and compliance risk
2. **Causal Analyst Agent** — Constructs causal DAGs from narratives and performs counterfactual root cause analysis
3. **Router Agent** — Assigns complaints to the right team with priority levels
4. **Resolution Agent** — Generates remediation plans and regulatory-compliant response letters
5. **Quality Agent** — Validates consistency and provides explainability traces

### Key Differentiator: Causal Counterfactual Analysis
Instead of just labeling complaints, our system answers: *"What would have had to be different for this complaint to not have occurred?"* — providing actionable prevention strategies.

## Quick Start

```bash
git clone https://github.com/YOUR_TEAM/cfpb-agentic-complaint-system.git
cd cfpb-agentic-complaint-system
chmod +x setup.sh && ./setup.sh
# Edit .env with your API key
streamlit run app/streamlit_app.py
```

## Data

[CFPB Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/) — publicly available, updated daily.

## Tech Stack

LangGraph • Claude/GPT-4 • Streamlit • pandas • networkx • scikit-learn

## Team

University of Maryland — MSDS / [Your Team Name]

## License

MIT
