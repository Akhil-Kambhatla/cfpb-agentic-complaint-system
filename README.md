# CFPB Complaint Intelligence System
> Multi-Agent AI with Bayesian Risk Assessment

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

A multi-agent AI system that processes CFPB consumer complaint narratives through a 6-agent LangGraph pipeline, producing risk-assessed classifications, team routing decisions with Slack alerts, and regulatory-compliant resolution plans. What distinguishes this system is its Bayesian risk assessment layer: rather than assigning a flat priority score, we compute a posterior resolution probability with 90% credible intervals using PyMC, then measure the *risk gap* — how far a complaint's predicted outcome falls below the company's baseline. Analysis of 10,000 CFPB complaints revealed that product type drives 92% of resolution outcome predictability (Bayesian coefficient: 0.713), that resolution rates vary 25× across product categories (47% for credit reporting vs. 1.9% for student loans), and that 8.6% of complaints are dangerously under-prioritized — high regulatory risk paired with low resolution probability.

---

## Quick Start

Requires Python 3.10+, Node.js 18+, and an Anthropic API key.

```bash
# Clone
git clone https://github.com/Akhil-Kambhatla/cfpb-agentic-complaint-system.git
cd cfpb-agentic-complaint-system

# Setup: creates venv, installs deps, downloads sample data
chmod +x setup.sh && ./setup.sh

# Add your API keys
cp .env.example .env
# Edit .env — required:
#   ANTHROPIC_API_KEY=sk-ant-...
# Optional (Slack alerts):
#   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
#   SLACK_WEBHOOK_COMPLIANCE=...
#   SLACK_WEBHOOK_BILLING_DISPUTES=...
#   SLACK_WEBHOOK_FRAUD=...
#   SLACK_WEBHOOK_CUSTOMER_SERVICE=...
#   SLACK_WEBHOOK_LEGAL=...
#   SLACK_WEBHOOK_EXECUTIVE_ESCALATION=...

# Terminal 1 — Backend
source venv/bin/activate
cd api && uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd web && npm install && npm run dev

# Open http://localhost:3000
```

> **Cost note:** Each complaint analysis makes 5 LLM calls. At current Claude Sonnet pricing this costs ~$0.051 per complaint. Slack webhooks are optional — the system fully works without them.

---

## What This System Does

A complaint narrative flows through six agents in sequence:

1. **Classifier** — Maps the narrative to the official CFPB product/issue taxonomy (11 products, 90+ issues), assigns severity (low/medium/high/critical), and scores compliance risk (0–1).

2. **Bayesian Risk Analyzer** — Runs a PyMC logistic regression model to compute posterior resolution probability with 90% credible intervals. Extracts five features from the complaint and its context, then calculates the *risk gap* between the company's historical baseline and the predicted outcome. Fast: uses pre-sampled posteriors, no MCMC at inference time.

3. **Event Chain Analyst** — Traces the causal sequence of events in the narrative (cause → effect chains), identifies the root cause, and proposes a counterfactual intervention. Note: this is LLM-based sequence tracing, not formal causal inference with a structural equation model.

4. **Router** — Assigns the complaint to one of six internal teams (compliance, billing disputes, fraud, customer service, legal, executive escalation) and sets priority P1–P4 based on the Bayesian risk gap. Fires a Slack webhook to the assigned team's channel.

5. **Resolution Generator** — Produces a list of remediation steps, a professional customer response letter, and preventive recommendations. Cites applicable regulations (FCRA, FDCPA, TILA, EFTA, CFPA, UDAAP, Reg Z/E) based on product type.

6. **Quality Check** — Validates cross-agent consistency (e.g., a "credit card" classification should not reference mortgage law), scores per-agent confidence, and flags the result as pass / review / fail. Triggers a high-risk Slack alert if the risk gap exceeds the configured threshold.

---

## Architecture

```
Complaint Input (narrative + metadata)
          │
     Classifier
    (product, issue, severity, compliance_risk)
          │
    ┌─────┴──────┐
    │            │
 Bayesian     Event Chain
 Risk          Analyst
 Analyzer     (root cause,
 (resolution   counterfactual)
 probability,
 risk_gap)
    │            │
    └─────┬──────┘
          │
       Router ──────────────→ Slack (#team-channel)
  (team, P1-P4 priority)
          │
    Resolution Generator
  (remediation steps,
   customer letter,
   regulations)
          │
    Quality Check ──────────→ Slack (#cfpb-alerts) [if high risk]
  (confidence scores,
   consistency, pass/review/fail)
          │
    Final Output (PipelineOutput)
```

The pipeline is implemented as a LangGraph `StateGraph` with each agent as a timed node. The `PipelineOutput` schema captures all agent results plus per-agent latencies.

---

## Key Findings

All numbers derived from 10,000 CFPB complaints with consumer narratives (2024+):

- **Product type drives 92% of resolution predictability.** Bayesian coefficient: 0.713. This is the strongest single predictor in the model by a wide margin.
- **Resolution rates vary 25× across products.** Credit reporting complaints resolve favorably 47% of the time; student loan complaints resolve only 1.9% of the time.
- **8.6% of complaints are dangerously under-prioritized.** These complaints combine high regulatory risk with low predicted resolution probability — they get closed quietly but carry significant compliance exposure.
- **Regulation mentions are a strong signal.** Complaints that cite specific regulations (FCRA, FDCPA, TILA, etc.) or mention an attorney have measurably higher resolution probabilities, captured by the Bayesian feature contributions.

---

## Bayesian Model

The risk analyzer uses a Bayesian logistic regression trained with PyMC:

- **Sampler:** NUTS, 1,000 draws, 500 tuning steps, 2 chains
- **Training set:** 2,000 stratified complaints from the dev set
- **Stored as:** `data/processed/bayesian_model.pkl` (pre-sampled posteriors; no MCMC at inference time)

**Features:**

| Feature | Description |
|---------|-------------|
| `product_risk` | Normalized historical resolution rate for the complaint's product category |
| `length_scaled` | Normalized narrative length |
| `mentions_regulation` | Binary: text contains CFPB/FCRA/FDCPA/TILA/EFTA/UDAAP |
| `mentions_attorney` | Binary: text contains attorney/lawyer/law firm/sue/sued |
| `mentions_dollar` | Binary: text contains dollar amounts ($X or "X dollars") |

**Key outputs:** `resolution_probability` (posterior mean), `credible_interval_lower/upper` (5th/95th percentiles), `risk_gap` (company baseline − predicted), `feature_contributions` (per-feature linear contribution to posterior mean).

If the model file fails to load, the system falls back to a rule-based estimate and logs the fallback.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent orchestration | LangGraph (StateGraph) |
| LLM | Claude Sonnet 4 via Anthropic SDK |
| Bayesian inference | PyMC |
| Backend API | FastAPI |
| Frontend | Next.js 15, React, TypeScript |
| Styling & animation | Tailwind CSS, Framer Motion |
| Charts | Recharts |
| Real-time streaming | Server-Sent Events (SSE) |
| Slack alerts | Slack Incoming Webhooks |
| Data processing | Pandas, scikit-learn |
| Graph / event chains | NetworkX |
| Data validation | Pydantic v2 |

---

## API Reference

All endpoints are prefixed with `/api`. Interactive docs at `http://localhost:8000/docs`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Run full pipeline, stream results as SSE (per-agent completion events) |
| `POST` | `/api/analyze-simple` | Run full pipeline, return all results as JSON |
| `POST` | `/api/analyze-batch` | Stream batch analysis as SSE (up to 8 complaints) |
| `POST` | `/api/analyze-batch-sync` | Synchronous batch analysis, returns JSON |
| `POST` | `/api/analyze-batch-csv` | Upload CSV (max 5 rows), auto-detects narrative column |
| `POST` | `/api/export-results` | Export batch results as CSV download |
| `GET` | `/api/export-sample` | Download a CSV template for batch upload |
| `POST` | `/api/evaluation/run` | Run classifier evaluation against ground truth |
| `GET` | `/api/evaluation` | Return cached evaluation metrics (or mock if not yet run) |
| `GET` | `/api/company/{name}` | Per-company statistics (resolution rate, complaint count) |
| `GET` | `/api/company-names` | Sorted list of all companies with available stats |
| `GET` | `/api/company-stats` | Aggregate company statistics |
| `GET` | `/api/company-stats/{name}` | Statistics for a specific company |
| `GET` | `/api/sample-complaints` | 10 pre-selected diverse sample complaints |
| `POST` | `/api/webhook/salesforce` | Salesforce Case integration webhook |
| `POST` | `/api/webhook/generic` | Generic CRM integration webhook |
| `GET` | `/api/cost-estimate` | Cost and ROI calculator |
| `GET` | `/api/health` | Health check |

---

## Project Structure

```
cfpb-agentic-complaint-system/
├── api/
│   ├── main.py             # FastAPI app init, CORS config
│   └── routes.py           # All API endpoints
├── src/
│   ├── config.py           # Regulations map, constants
│   ├── agents/
│   │   ├── orchestrator.py     # LangGraph StateGraph pipeline
│   │   ├── classifier.py       # Product/issue/severity classification
│   │   ├── risk_analyzer.py    # Bayesian logistic regression
│   │   ├── causal_analyst.py   # Event chain / root cause analysis
│   │   ├── router.py           # Team routing + priority assignment
│   │   ├── resolution.py       # Remediation plan + customer letter
│   │   └── quality_check.py    # Consistency validation + confidence
│   ├── models/
│   │   └── schemas.py          # Pydantic v2 schemas for all I/O
│   ├── data/
│   │   ├── loader.py           # CFPB data loading and filtering
│   │   └── company_stats.py    # Company resolution rate cache
│   ├── evaluation/
│   │   └── metrics.py          # Classifier evaluation runner
│   └── utils/
│       ├── llm.py              # Anthropic/OpenAI client wrapper
│       ├── prompts.py          # All prompt templates as constants
│       ├── slack.py            # Slack webhook integration
│       └── cost_calculator.py  # Per-complaint cost estimation
├── web/                    # Next.js 15 frontend
│   └── src/
│       ├── app/            # Pages: about/, analyze/, evaluation/
│       ├── components/     # 15+ React components
│       ├── contexts/       # AnalysisContext (global state)
│       └── types/          # TypeScript interfaces
├── data/
│   ├── processed/          # 10K dev set, Bayesian model (.pkl)
│   └── sample/             # 100-complaint public sample
├── notebooks/              # EDA and model prototyping
├── tests/                  # test_pipeline.py
├── setup.sh                # Bootstrap script
├── requirements.txt
└── .env.example
```

---

## Data

- **Source:** [CFPB Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/) — U.S. Government public domain
- **Working dataset:** 10,000 complaints with consumer narratives, filtered from the 2024+ full download (~25–30% of all CFPB records have narratives)
- **Coverage:** 11 product categories, 90+ distinct issue types
- **Committed to repo:** `data/sample/cfpb_sample_100.csv` (100 complaints fetched from CFPB API during setup)
- **Not committed:** Full raw CSV (~2–3 GB) and the 10K dev set are gitignored

To use your own data: download the full CSV from the CFPB link above, place it at `data/raw/complaints.csv`, then run `python -m src.data.loader` to generate the processed dev set.

---

## Evaluation Results

Evaluated on 50 complaints stratified by product, using zero-shot classification (no fine-tuning):

| Metric | Value | Sample Size | Notes |
|--------|-------|-------------|-------|
| Product accuracy | 70% | 50 complaints | Zero-shot; no training data used |
| Issue accuracy | 36% | 50 complaints | Consumer-selected labels are inconsistent |
| Avg agent confidence | 89% | 50 complaints | Self-assessed by the LLM |
| Bayesian model accuracy | 59.9% | 5-fold CV, 10K | Reflects inherent outcome uncertainty |

The 36% issue accuracy is expected: consumers self-select issue labels under CFPB taxonomy in ways that don't always match what an analyst would choose. The Bayesian model's 59.9% accuracy reflects genuinely uncertain complaint resolution outcomes — the model is well-calibrated, not undertrained.

---

## Cost Analysis

| Item | Cost |
|------|------|
| Per complaint (Claude Sonnet) | ~$0.051 |
| 10,000 complaints/month | ~$510 API + ~$70 infrastructure |
| Processing time per complaint | ~8–10 seconds |

These are estimates based on observed token usage across the 5 LLM calls in the pipeline. Actual costs vary with narrative length.

---

## Limitations and Future Work

**Current limitations:**

- **Latency:** 5–6 sequential LLM calls per complaint → ~8–10s end-to-end. Not suitable for real-time ingest without async queuing.
- **Static Bayesian model:** Trained on a 10K snapshot. Does not retrain automatically as new complaints arrive.
- **Event chain analysis:** LLM-based sequence tracing, not formal causal inference with a structural equation model or do-calculus. Results are plausible but not provably causal.
- **70% product accuracy:** Zero-shot approach. A fine-tuned classifier on CFPB labeled data could likely exceed 95%.
- **Risk gap thresholds:** Priority cutoffs (P1: risk_gap > 0.30, etc.) are set manually, not empirically calibrated against actual regulatory outcomes.
- **Compliance risk scores:** System-generated via LLM and Bayesian features. Not validated against actual enforcement actions.
- **Batch processing:** Single-threaded. Production use would need an async task queue (Celery, ARQ).
- **Customer letters:** Generated but not delivered — no email integration (SendGrid/SES) is wired.

**Future work:**

- Fine-tune a BERT-based classifier on CFPB labeled data for >90% product accuracy
- Temporal drift monitoring to detect emerging complaint patterns
- Demographic fairness analysis (requires data currently not collected)
- Real CRM integrations (Salesforce, ServiceNow) beyond the current webhook prototype
- Automated retraining pipeline on fresh weekly CFPB exports
- Real email delivery for customer response letters
- Company-level compliance dashboards for internal risk teams

---

## Competition Context

- **Competition:** 2026 UMD Agentic AI Challenge
- **Host:** Robert H. Smith School of Business, Center for Artificial Intelligence in Business
- **Challenge:** Build autonomous AI agents for real business problems
- **Team:** University of Maryland, MS Data Science

---

## License

MIT
