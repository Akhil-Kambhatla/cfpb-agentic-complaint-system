# CLAUDE.md — Master Instructions for Claude Code

## Project Overview

**Project:** CFPB Agentic Complaint Categorization System
**Competition:** 2026 UMD Agentic AI Challenge (Robert H. Smith School of Business)
**Deadline:** April 10, 2026 (Initial Submission Package)
**Final Presentation:** April 24, 2026 (if selected by April 14)
**Team Size:** 4-5 UMD students

### Deliverables
1. A 5-minute demo video showing the fully/partially working prototype
2. A reproducibility and usage PDF (max 5 pages), named after the team
3. Optional supporting files via Google Drive link

### Evaluation Criteria
- **Novelty** — our differentiator is causal counterfactual root cause analysis
- **Methodology** — multi-agent architecture with LangGraph
- **Clarity** — explainable decisions suitable for regulators

---

## What We Are Building

A **multi-agent AI system** using LangGraph that processes CFPB consumer complaint narratives and:
1. Classifies complaints by product, issue type, severity, and compliance risk
2. Constructs causal graphs from complaint narratives and performs counterfactual root cause analysis
3. Routes complaints to the appropriate internal team
4. Generates resolution plans with regulatory-compliant customer response letters
5. Provides explainability traces and confidence scores for every decision

### Differentiator: Causal Counterfactual Analysis
Instead of just classifying "what" a complaint is about, we answer: **"What would have had to be different for this complaint to not have occurred?"**
- Extract causal DAGs from complaint narratives using LLM
- Perform backtracking counterfactual interventions
- Report causal depth (hops from root cause to complaint) and intervention recommendations
- This ties into academic research on backtracking counterfactuals (von Kügelgen et al.)

---

## Architecture

```
CFPB Complaint Input (narrative + metadata)
        │
        ▼
┌─────────────────────────────┐
│     Orchestrator Agent      │  ← LangGraph StateGraph supervisor
│  (coordinates all agents)   │
└─────────┬───────────────────┘
          │
    ┌─────┼─────────┬──────────────┐
    ▼     ▼         ▼              ▼
┌──────┐┌────────┐┌──────┐┌────────────┐
│Class-││Causal  ││Router││Resolution  │
│ifier ││Analyst ││Agent ││Agent       │
└──────┘└────────┘└──────┘└────────────┘
    │     │         │              │
    └─────┴─────────┴──────────────┘
          │
          ▼
┌─────────────────────────────┐
│  Quality + Explainability   │
│  Check Agent                │
└─────────────────────────────┘
          │
          ▼
┌─────────────────────────────┐
│     Structured Output       │
│  Classification + Causal    │
│  Graph + Resolution Plan +  │
│  Customer Response Letter   │
└─────────────────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  Streamlit Dashboard        │
│  Metrics: accuracy,         │
│  fairness, resolution       │
│  quality, latency           │
└─────────────────────────────┘
```

### Agent Specifications

**1. Classifier Agent**
- Input: Raw complaint narrative + metadata
- Output: JSON with product, sub_product, issue, sub_issue, severity (low/medium/high/critical), compliance_risk_score (0-1)
- Validation: Compare against CFPB ground truth labels for accuracy metrics
- Method: LLM structured output with few-shot examples from CFPB categories

**2. Causal Analyst Agent**
- Input: Complaint narrative + classification output
- Output: Causal DAG (as networkx graph JSON), root_cause, causal_depth, counterfactual_intervention, prevention_recommendation
- Method:
  1. Prompt LLM to extract causal chain as structured JSON: [{event, cause, effect}]
  2. Build networkx DiGraph from extracted relationships
  3. Prompt LLM with graph structure + intervention query: "If [intervention], would this complaint have occurred?"
  4. Return causal depth (longest path in DAG) and intervention point
- This is our NOVELTY — most teams will skip causal analysis

**3. Router Agent**
- Input: Classification + severity + compliance_risk
- Output: assigned_team, priority_level, escalation_flag
- Teams: compliance, billing_disputes, fraud, customer_service, legal, executive_escalation
- Method: Hybrid rule-based + LLM reasoning for ambiguous cases

**4. Resolution Agent**
- Input: All prior agent outputs
- Output: remediation_steps (list), customer_response_letter (text), preventive_recommendations (list), estimated_resolution_timeline
- Must reference specific regulations (CFPA, TILA, FCRA, FDCPA) based on product type
- Customer letter must be regulatory-compliant and professional

**5. Quality + Explainability Agent**
- Input: All prior outputs
- Output: confidence_scores (per-agent), reasoning_trace, quality_flag (pass/review/fail)
- Validates consistency across agents (e.g., classifier says "credit card" but resolution references mortgage law)

---

## Tech Stack

| Component | Tool | Version |
|-----------|------|---------|
| Orchestration | LangGraph | latest |
| LLM Integration | langchain-anthropic | latest |
| LLM | Claude (via subscription — see auth note below) | Sonnet 4.6 |
| Data Processing | pandas, numpy | latest |
| Causal Graphs | networkx | latest |
| Evaluation | scikit-learn | latest |
| UI | streamlit | latest |
| Environment | python-dotenv | latest |
| HTTP | requests | latest |

### LLM Authentication
The developer uses a Claude Pro/Max subscription. For LLM calls within the LangGraph agents, we use the Anthropic Python SDK. The developer needs to either:
- Option A: Get an API key from console.anthropic.com (requires separate billing — $5 minimum credit)
- Option B: Use a free-tier alternative like OpenAI's free credits, or use Hugging Face Inference API for prototyping
- Option C: Use Claude Code itself as an intermediary (not ideal for production pipeline)

**For now, structure the code to accept ANTHROPIC_API_KEY from .env. If unavailable, fall back to OPENAI_API_KEY. The code must work with either provider.**

---

## Project Structure

```
cfpb-agentic-complaint-system/
├── CLAUDE.md                   # This file — master instructions
├── README.md                   # Project README for GitHub + judges
├── .env.example                # Template for environment variables
├── .gitignore
├── requirements.txt
├── setup.py                    # Optional package setup
│
├── data/
│   ├── raw/                    # Raw CFPB CSV (gitignored — too large)
│   ├── processed/              # Filtered/sampled data for development
│   └── sample/                 # Small sample for testing (committed)
│
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_agent_prototyping.ipynb
│   └── 03_evaluation.ipynb
│
├── src/
│   ├── __init__.py
│   ├── config.py               # Settings, API keys, constants
│   ├── data/
│   │   ├── __init__.py
│   │   ├── loader.py           # CFPB data loading and filtering
│   │   └── preprocessor.py     # Text cleaning, sampling
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestrator.py     # LangGraph StateGraph + supervisor logic
│   │   ├── classifier.py       # Product/issue/severity classification
│   │   ├── causal_analyst.py   # Causal DAG construction + counterfactuals
│   │   ├── router.py           # Team assignment + priority
│   │   ├── resolution.py       # Remediation plan + customer letter
│   │   └── quality_check.py    # Explainability + confidence scoring
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic models for all agent I/O
│   ├── evaluation/
│   │   ├── __init__.py
│   │   ├── metrics.py          # Accuracy, fairness, resolution quality
│   │   └── benchmarks.py       # Ground truth comparison
│   └── utils/
│       ├── __init__.py
│       ├── llm.py              # LLM client wrapper (Anthropic/OpenAI)
│       └── prompts.py          # All prompt templates
│
├── app/
│   └── streamlit_app.py        # Streamlit demo dashboard
│
├── tests/
│   ├── test_classifier.py
│   ├── test_causal_analyst.py
│   └── test_pipeline.py
│
└── docs/
    ├── architecture.md
    └── reproducibility.md      # Will become the 5-page PDF
```

---

## Data Details

### Source
CFPB Consumer Complaint Database: https://www.consumerfinance.gov/data-research/consumer-complaints/

### Key Columns
| Column | Type | Use |
|--------|------|-----|
| date_received | date | Time-based analysis |
| product | categorical | Ground truth for classifier |
| sub_product | categorical | Ground truth for classifier |
| issue | categorical | Ground truth for classifier |
| sub_issue | categorical | Ground truth for classifier |
| consumer_complaint_narrative | text | PRIMARY INPUT — free text from consumer |
| company | categorical | For root cause patterns |
| state | categorical | For fairness analysis + compliance (state-specific regs) |
| zip_code | text | Geographic analysis |
| company_response_to_consumer | categorical | Evaluation baseline |
| timely_response | yes/no | Quality metric |
| consumer_disputed | yes/no | Outcome indicator |
| complaint_id | int | Unique ID |

### Data Strategy
1. Download full CSV (~2-3GB)
2. Filter for rows WHERE consumer_complaint_narrative IS NOT NULL (only ~25-30% of records)
3. Create a working sample of 10,000 records for development
4. Create a test set of 1,000 records for evaluation
5. Commit only the small sample (100 records) to git in data/sample/

---

## Development Priorities (in order)

### Phase 1: Setup + Data (Days 1-2)
- [ ] Project scaffold with all directories
- [ ] Virtual environment + requirements.txt
- [ ] Data download script
- [ ] EDA notebook
- [ ] Small sample committed to repo

### Phase 2: Core Agents (Days 3-7)
- [ ] Pydantic schemas for all agent I/O
- [ ] LLM wrapper (supports Anthropic + OpenAI)
- [ ] Classifier agent with prompt engineering
- [ ] Causal analyst agent (DAG + counterfactuals)
- [ ] Router agent
- [ ] Resolution agent
- [ ] Quality check agent

### Phase 3: Orchestration (Days 7-9)
- [ ] LangGraph StateGraph wiring
- [ ] End-to-end pipeline test
- [ ] Error handling + fallbacks

### Phase 4: UI + Evaluation (Days 9-11)
- [ ] Streamlit dashboard
- [ ] Accuracy metrics (classifier vs ground truth)
- [ ] Fairness analysis (by state/product)
- [ ] Latency benchmarks

### Phase 5: Submission (Days 12-14)
- [ ] 5-minute demo video
- [ ] 5-page reproducibility PDF
- [ ] GitHub cleanup + README

---

## Coding Standards

- Python 3.10+
- Type hints on all functions
- Pydantic v2 for data models
- f-strings, not .format()
- Docstrings on all public functions
- No print() in production code — use logging module
- All prompts in src/utils/prompts.py as constants
- .env for all secrets (never commit)

---

## gstack (optional)
If gstack is installed, the following skills are useful for this project:
- /office-hours — for framing the product before coding
- /plan-eng-review — for locking architecture
- /review — for code review before submission
- /qa — for testing the Streamlit UI

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/review, /ship, /qa, /qa-only, /design-review, /investigate, /retro,
/careful, /freeze, /guard, /unfreeze, /gstack-upgrade.
