# CFPB Agentic Complaint Categorization System

> 2026 UMD Agentic AI Challenge — Robert H. Smith School of Business

A multi-agent AI system that processes consumer financial complaints using Bayesian Risk Intelligence to not just classify complaints, but quantify *resolution probability*, identify *risk gaps*, and recommend *targeted interventions*.

## Problem

Financial service companies receive thousands of complaints that are inconsistently categorized, manually routed, and often delayed. This increases regulatory risk and customer churn.

## Our Approach

We built a **5-agent orchestrated pipeline** using LangGraph that goes beyond classification:

1. **Classifier Agent** — Categorizes by product, issue, severity, and compliance risk
2. **Bayesian Risk Analyzer** — Computes posterior resolution probability with credible intervals using a pre-trained Bayesian logistic regression model
3. **Event Chain Agent** — Reconstructs the event sequence from the narrative and identifies the key risk-based intervention point
4. **Router Agent** — Assigns complaints to the right team with priority levels driven by the Bayesian risk gap
5. **Resolution Agent** — Generates remediation plans and regulatory-compliant response letters
6. **Quality Agent** — Validates consistency and provides explainability traces

### Key Differentiator: Bayesian Risk Intelligence
Instead of just labeling complaints, our system answers: *"What is the probability this complaint gets resolved, and what specific intervention will change that outcome?"* — combining probabilistic risk assessment with actionable prevention strategies.

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
