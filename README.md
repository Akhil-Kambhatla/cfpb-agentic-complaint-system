# CFPB Complaint Intelligence System

> Autonomous multi-agent AI for consumer complaint management with Bayesian risk assessment

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green)
![Claude AI](https://img.shields.io/badge/Claude_AI-Sonnet_4-orange)
![PyMC](https://img.shields.io/badge/PyMC-Bayesian-purple)

This system processes CFPB consumer complaint narratives through a six-agent AI pipeline that classifies complaints, assesses regulatory risk with Bayesian inference, traces the event chain leading to the complaint, routes to the correct internal team via Slack, generates a regulatory-compliant resolution plan and customer letter, and manages the full case lifecycle through a Kanban-style dashboard. What makes it different from generic complaint management software is the Bayesian risk layer: a PyMC logistic regression model trained on 35,000 real CFPB complaints predicts each complaint's resolution probability with a 95% credible interval, surfaces a **risk gap** (cases likely to be dismissed that should not be), and drives prioritization — a finding grounded in the key result that product type alone (coefficient 0.58) explains most of the variance in resolution outcomes. The system integrates real Slack webhooks, real Gmail delivery, and polls the live CFPB API autonomously every 30 minutes.

## Live Demo
**[cfpb-agentic-complaint-system.vercel.app](https://cfpb-agentic-complaint-system.vercel.app)**
No setup required. API key pre-configured on the demo server.
---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Setup (5 minutes)

```bash
# Clone
git clone https://github.com/Akhil-Kambhatla/cfpb-agentic-complaint-system.git
cd cfpb-agentic-complaint-system

# Python environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# Edit .env — at minimum, set ANTHROPIC_API_KEY

# Download and process CFPB data (optional — pre-processed data included)
# python scripts/prepare_100k_dataset.py
# python scripts/train_bayesian_model.py

# Start the backend (Terminal 1)
cd api && uvicorn main:app --reload --port 8000

# Start the frontend (Terminal 2)
cd web && npm install && npm run dev

# Open http://localhost:3000
# Interactive API docs: http://localhost:8000/docs
```

---

## The Problem

Financial institutions receive thousands of CFPB complaints monthly. Processing is largely manual: complaints are triaged, routed based on category labels, and either closed with an explanation or escalated. Of the 100,000 complaints we analyzed, **59.8% were closed with just an explanation** and only 1.4% received monetary relief — yet consumers disputed those explanation-only closures at a 21.5% rate, compared to 9.9% for monetary relief cases. The system routinely closes complaints that consumers view as unresolved.

The deeper problem is risk prioritization. Current approaches treat all complaints of a given product type equivalently, missing the **risk gap**: complaints where regulatory risk is high but resolution probability is low, indicating the institution is likely to dismiss a complaint it should act on. In our dataset, **12.0% of complaints** (11,974 out of 100,000) fall into this high-risk-gap category. Standard complaint platforms like Zendesk, Salesforce Service Cloud, and ServiceNow primarily focus on classification, routing, and case tracking. While they can be extended with analytics, they do not natively provide proactive risk prediction or explicitly surface mismatches between perceived and actual risk.

CFPB enforcement actions range from $100K to tens of millions of dollars. The complaint management software market is $3.2B and growing. The gap between existing tools and what compliance teams actually need is a system that reasons about risk, not just category.

---

## Our Solution

```
Complaint Input (narrative + metadata)
         |
   Classifier Agent
   (Claude Haiku — ~1.5s)
         |
    ─────┴──────────────────────────────
    |                                  |
Risk Analyzer                  Event Chain Agent
(Bayesian — ~0.1s)             (Claude Sonnet — ~10s)
    |                                  |
    ──────────────────┬────────────────
                      |
               Router Agent
               (Claude Haiku — ~1.5s)
                      |
            Resolution Generator
            (Claude Sonnet — ~8s)
                      |
            Quality Check Agent
            (Claude Haiku — ~3s)
                      |
    ──────────────────┴──────────────────────
    |                 |           |          |
Case Created     Slack Alert    Email      Kanban
(SQLite)         (team channel) (consumer) (Monitor)
```

The pipeline runs in approximately 8–28 seconds per complaint depending on narrative length. Risk Analyzer and Event Chain run in parallel after classification. The system then manages the full autonomous lifecycle:

1. Backend polls CFPB API every 30 minutes for new complaints
2. Each complaint is processed through all six agents
3. A case is created with product-specific regulatory tasks
4. The assigned team receives a Slack alert with risk details
5. Consumer receives an acknowledgment email
6. Human agents work through tasks, tracked on the Kanban board
7. When all tasks are complete, a resolution email with a satisfaction survey is sent
8. Consumer clicks a star rating → case closes → CSAT recorded

---

## Agents

### 1. Classifier Agent

Uses **Claude Haiku** for speed. Classifies each complaint into 12 canonical CFPB product categories (mapped from 21 raw CFPB names), predicts the issue type, assigns severity (low/medium/high/critical), and estimates compliance risk (0–1). Uses 5 few-shot examples to anchor outputs. Truncates narratives to 3,000 characters for token efficiency.

- **Model:** Claude Haiku (`claude-haiku-4-5-20251001`)
- **Product accuracy:** 88% on 50-complaint evaluation
- **Issue accuracy:** 54% on 50-complaint evaluation
- **Why not higher?** This is zero-shot/few-shot with no fine-tuning. Claude has never been trained on CFPB labels specifically — it uses general knowledge plus 5 examples. CFPB has 159+ issue types, many semantically overlapping (e.g., "Problem with a company's investigation" vs. "Problem with a credit reporting company's investigation"). A fine-tuned model on the full labeled dataset would reach 95%+, and is on our roadmap. The tradeoff: our approach requires zero training data, adapts immediately to new categories, and costs nothing to retrain.

### 2. Bayesian Risk Analyzer

Does **not** call an LLM. Pure statistical inference using a PyMC Bayesian logistic regression model trained on 34,991 stratified CFPB complaints. Outputs resolution probability with a 95% credible interval, regulatory risk (heuristic), and the risk gap (regulatory risk minus resolution probability).

- **Model:** No LLM — NumPy sigmoid over posterior samples
- **Training:** PyMC, NUTS sampler, 1,000 draws, 500 tuning steps, 2 chains
- **Features:** product resolution rate, narrative length, regulation mentions, attorney mentions, dollar amount mentions
- **Key finding:** Product type coefficient (0.58 ± 0.014) dominates all other features
- **Latency:** ~0.1 seconds (no API call)

**Coefficient summary (from 34,991-complaint training run):**

| Feature | Coefficient (mean) | 95% CI |
|---|---|---|
| Product resolution rate | 0.581 | [0.554, 0.608] |
| Mentions dollar amount | 0.070 | [0.039, 0.101] |
| Mentions attorney | -0.046 | [-0.074, -0.018] |
| Mentions regulation | 0.014 | [-0.015, 0.042] |
| Narrative length | -0.016 | [-0.050, 0.016] |

Attorney mentions are negatively associated with resolution — a counterintuitive finding that may reflect escalation selection bias (consumers who mention attorneys tend to have more complex, harder-to-resolve complaints).

### 3. Event Chain Agent

Uses **Claude Sonnet** (requires sustained reasoning). Traces the chronological sequence of events in the complaint narrative — what happened first, what it caused, where the complaint escalated — and identifies the root event and the single most effective intervention point. This is LLM-based pattern recognition over narrative text, not formal causal DAG inference.

- **Model:** Claude Sonnet (`claude-sonnet-4-20250514`)
- **Output:** causal chain (list of cause→effect edges), root cause, causal depth, prevention recommendation
- **Latency:** ~10 seconds (pipeline bottleneck)

### 4. Router Agent

Uses **Claude Haiku**. Assigns complaints to one of six teams — `compliance`, `billing_disputes`, `fraud`, `customer_service`, `legal`, `executive_escalation` — and sets priority P1–P4 based on severity and Bayesian risk gap. Triggers a real Slack message to the team's dedicated webhook channel.

- **Model:** Claude Haiku
- **Inputs:** product, issue, severity, compliance risk, root cause, risk gap, risk level
- **Latency:** ~1.5 seconds

### 5. Resolution Generator

Uses **Claude Sonnet** (needs writing quality). Generates a numbered remediation plan, a consumer-facing response letter that references applicable consumer protection laws (TILA, FCRA, FDCPA, RESPA, EFTA, UDAAP), and preventive recommendations. Letters reference consumer rights — not company violations — to maintain a defensible posture.

- **Model:** Claude Sonnet
- **Output:** remediation steps, customer response letter, applicable regulations, estimated resolution days
- **Latency:** ~8 seconds

### 6. Quality Check Agent

Uses **Claude Haiku**. Reviews all five prior outputs for internal consistency (e.g., does the classifier say "credit card" while the resolution references mortgage law?), computes per-agent confidence scores, and flags cases as `pass`, `review`, or `fail`. Cases below 70% overall confidence are flagged for human review.

- **Model:** Claude Haiku
- **Output:** overall confidence, per-agent confidence scores, consistency issues, quality flag
- **Latency:** ~3 seconds

---

## Bayesian Risk Intelligence

Most complaint systems classify and route. We also **predict**. The Bayesian Risk Analyzer answers a different question: given what we know about this product type, this narrative, and these risk signals — what is the probability this complaint gets a meaningful resolution, and does that match how risky it actually is?

The model was trained on 34,991 stratified CFPB complaints using PyMC's No-U-Turn Sampler. Unlike frequentist logistic regression, it returns a full posterior distribution over resolution probability, which we collapse to a point estimate plus 95% credible interval. The credible interval is shown on the UI — it communicates how certain the model is, not just what it predicts.

**Key findings from 100,000-complaint analysis:**

- Product type resolution rates range from 0% (Virtual Currency, Payday Loan) to 44.7% (Credit Reporting — likely inflated by credit bureau bulk responses)
- The three credit bureau giants (Equifax, TransUnion, Experian) account for 75,697 of 100,000 complaints
- **12.0% of complaints** have a high risk gap (regulatory risk > resolution probability + 0.2) — cases that are likely to be dismissed despite carrying real regulatory exposure
- Mean resolution probability across the dataset: 36.7%
- Predicted satisfaction by resolution type: monetary relief → 4.6/5, explanation-only → 3.9/5 (based on real CFPB dispute rates from 5,271 complaints)

---

## Autonomous Monitoring

The system runs without manual triggering. On startup, the FastAPI backend launches a background scheduler that polls the CFPB public API every 30 minutes (configurable via `CFPB_POLL_INTERVAL_MINUTES`), processes each new complaint through the full pipeline, and creates cases automatically.

The Monitor dashboard (`/monitor`) provides:

- **Kanban board** — cases across `OPEN`, `IN PROGRESS`, `ACTION TAKEN`, `AWAITING RESPONSE`, `CLOSED`
- **Activity feed** — real-time log of what the system processed and when
- **Email outbox** — every acknowledgment and resolution email sent, with full body preview
- **Complaint clusters** — pattern detection grouping complaints by company/product
- **CSAT tracking** — predicted satisfaction on each case; actual ratings when consumers respond
- **Daily report** — downloadable summary of pipeline activity

---

## Case Management Lifecycle

Each processed complaint becomes a case with product-specific regulatory tasks automatically generated:

| Product | Task Examples | Regulation |
|---|---|---|
| Credit Card | Issue provisional credit, complete FCBA investigation | FCBA §161, Reg Z §226.13 |
| Debt Collection | Send validation notice, cease collection if disputed | FDCPA §809(b) |
| Credit Reporting | Initiate FCRA dispute, monitor 30-day deadline | FCRA §611 |
| Mortgage | Acknowledge within 5 business days, complete in 30 | RESPA §6(e) |

**Lifecycle states:**

1. `OPEN` → case created, acknowledgment email sent to consumer
2. Human clicks "Start Working" → `IN PROGRESS`
3. Human completes tasks one by one → progress tracked
4. All tasks complete → `ACTION TAKEN`
5. Human clicks "Resolve Case" → resolution email + survey sent → `AWAITING RESPONSE`
6. Consumer clicks rating in email → satisfaction recorded → `CLOSED`

---

## Real Integrations

**Slack** — 7 webhooks: one general high-risk alert channel plus one per team (`compliance`, `billing_disputes`, `fraud`, `customer_service`, `legal`, `executive_escalation`). Messages include complaint ID, product, severity, risk gap, and the Bayesian resolution probability. Configurable via `.env`.

**Email (Gmail SMTP)** — Two real emails per case: (1) acknowledgment on case creation, (2) resolution letter with consumer rights summary and clickable satisfaction rating links (1–5 stars). Ratings are handled server-side and require no consumer account.

**CFPB Public API** — Polls the CFPB public search API for new complaints, processes both narrative and metadata-only complaints (narrative-free complaints receive a lighter analysis path).

**Salesforce webhook** — `/api/webhook/salesforce` accepts Salesforce Case payload format and returns AI-enriched fields (product classification, risk score, routing recommendation) for drop-in integration with existing CRM workflows.

---

## Evaluation Results

| Metric | Value | Sample | Notes |
|---|---|---|---|
| Product accuracy | 88% | 50 complaints | Zero-shot/few-shot, no fine-tuning |
| Issue accuracy | 54% | 50 complaints | 159 overlapping CFPB issue types |
| Bayesian training samples | 34,991 | Stratified from 100K | NUTS, 1,000 draws, 2 chains |
| High risk gap complaints | 12.0% | 100K analyzed | Risk gap > 0.2 |
| Mean resolution probability | 36.7% | 100K | Matches CFPB empirical rate of 36.9% |
| Cost per complaint | $0.051 | — | 2,000 input + 3,000 output tokens |
| Avg pipeline latency | ~8.4 seconds | — | 6 agents, parallel risk+event chain |

**On accuracy:** 88% product accuracy with zero training data and 5 few-shot examples is strong. Issue accuracy at 54% reflects genuine label ambiguity in the CFPB taxonomy — even human annotators frequently disagree on the correct sub-issue when filing. For the purposes of routing and resolution, product classification matters more than exact issue subcategory.

---

## Data

- **Source:** CFPB Consumer Complaint Database (public, free, updated daily)
- **Total database size:** 14,380,818 complaints
- **Analysis dataset:** 100,000 stratified complaints (`data/processed/analysis_100k.csv`)
- **Bayesian training set:** 34,991 stratified complaints (`data/processed/bayesian_train_35k.csv`)
- **Dev/test set:** 10,000 complaints with narratives (`data/processed/dev_set_10k.csv`)
- **Raw data:** gitignored (2–3GB CSV) — download via `scripts/prepare_100k_dataset.py`
- **Narratives present:** 26.1% of the 100K sample (26,079 complaints)
- **Median narrative length:** 662 characters; mean 1,011

---

## API Documentation

Interactive docs available at `http://localhost:8000/docs` when the server is running.

**Analysis**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze` | Analyze a single complaint narrative |
| POST | `/api/analyze-batch` | Async batch analysis |
| POST | `/api/analyze-batch-csv` | Batch analysis from CSV upload |
| POST | `/api/analyze-batch-sync` | Synchronous batch analysis |
| POST | `/api/analyze-simple` | Lightweight analysis (no event chain) |

**Data & Stats**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dataset-stats` | Aggregate stats from 100K analysis |
| GET | `/api/bayesian-coefficients` | Posterior means and credible intervals |
| GET | `/api/sample-complaints` | Sample complaint narratives for demo |
| GET | `/api/company/{company_name}` | Company-level risk stats |
| GET | `/api/company-names` | List of companies in dataset |
| GET | `/api/company-stats` | Aggregate company risk summary |
| GET | `/api/cost-estimate` | API cost estimate for N complaints |
| GET | `/api/stats/avg-latency` | Observed pipeline latency stats |
| GET | `/api/evaluation` | Pre-computed evaluation metrics |
| POST | `/api/evaluation/run` | Run live evaluation on sample set |

**Case Management**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cases` | List all cases |
| GET | `/api/cases/stats` | Case counts by status |
| GET | `/api/cases/satisfaction` | CSAT summary |
| GET | `/api/cases/{case_number}` | Get case detail |
| GET | `/api/cases/{case_number}/full-result` | Full pipeline output for a case |
| POST | `/api/cases/{case_number}/start` | Move case to IN PROGRESS |
| POST | `/api/cases/{case_number}/tasks/{task_id}/complete` | Mark a task complete |
| POST | `/api/cases/{case_number}/resolve` | Send resolution email, move to AWAITING RESPONSE |
| POST | `/api/cases/{case_number}/dispute` | Record consumer dispute |
| GET | `/api/satisfaction/{case_number}/rate` | Consumer-facing rating page (HTML) |

**Monitor**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/monitor/status` | Monitoring system status |
| POST | `/api/monitor/poll-now` | Trigger immediate CFPB poll |
| GET | `/api/monitor/activity` | Recent activity feed |
| GET | `/api/monitor/activity/all` | Full activity history |
| GET | `/api/monitor/patterns` | Detected complaint clusters |
| POST | `/api/monitor/patterns/{pattern_id}/resolve` | Mark pattern resolved |
| GET | `/api/monitor/stats` | Monitor summary stats |
| GET | `/api/monitor/chart-data` | Chart-ready time series |
| GET | `/api/monitor/complaints` | All monitored complaints |
| POST | `/api/monitor/simulate` | Simulate a new complaint (demo) |
| GET | `/api/monitor/emails` | Email outbox |
| GET | `/api/monitor/learning` | Learning/adaptation log |
| GET | `/api/reports/daily` | Daily activity report |

**Integrations & Export**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/webhook/salesforce` | Salesforce Case format ingest |
| POST | `/api/webhook/generic` | Generic JSON complaint ingest |
| POST | `/api/export-results` | Export analysis results as JSON |
| GET | `/api/export-sample` | Export sample CSV |
| GET | `/api/health` | Health check |

---

## Cost Analysis

| Volume | API Cost | Notes |
|---|---|---|
| Per complaint | $0.051 | 2,000 input tokens ($3/M) + 3,000 output tokens ($15/M) |
| 10,000/month | ~$510 | API only |
| 50,000/month | ~$2,550 | API only |

These are API costs only. Production deployment would add infrastructure (~$50–500/month depending on scale), monitoring, and compliance overhead. The Bayesian Risk Analyzer is free — it's a NumPy matrix multiply, no API call.

---

## Tech Stack

| Component | Technology |
|---|---|
| Agent orchestration | LangGraph (`StateGraph`), custom parallel nodes |
| LLM — reasoning agents | Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| LLM — fast agents | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Bayesian inference | PyMC, NUTS sampler, NumPy posterior evaluation |
| Backend | FastAPI, Python 3.10+, Uvicorn |
| Background scheduling | APScheduler |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Visualization | Recharts, D3, ReactFlow |
| Database | SQLite (WAL mode, 30s busy timeout) |
| Real-time alerts | Slack Incoming Webhooks |
| Email | Gmail SMTP (`smtplib`) |
| Data processing | Pandas, scikit-learn, NumPy |
| Animation | Framer Motion |

---

## Project Structure

```
cfpb-agentic-complaint-system/
├── api/
│   ├── main.py                  # FastAPI app, startup, CORS, router registration
│   ├── routes.py                # Analysis, evaluation, data, webhook endpoints
│   ├── case_routes.py           # Case management + satisfaction rating endpoints
│   └── monitor_routes.py        # Monitoring, patterns, email outbox endpoints
├── web/
│   └── src/
│       ├── app/
│       │   ├── page.tsx         # Home / landing page
│       │   ├── analyze/         # Single + batch complaint analysis UI
│       │   ├── monitor/         # Kanban board, activity feed, clusters
│       │   ├── evaluation/      # Accuracy, fairness, Bayesian metrics
│       │   └── about/           # Architecture, roadmap, team
│       ├── components/          # Shared UI components (charts, panels, diagrams)
│       └── contexts/
│           └── AnalysisContext.tsx  # Global state for analysis results
├── src/
│   ├── agents/
│   │   ├── orchestrator.py      # LangGraph StateGraph, parallel node wiring
│   │   ├── classifier.py        # Product/issue/severity classification
│   │   ├── risk_analyzer.py     # Bayesian posterior inference
│   │   ├── causal_analyst.py    # Event chain extraction
│   │   ├── router.py            # Team assignment + priority
│   │   ├── resolution.py        # Remediation plan + customer letter
│   │   ├── quality_check.py     # Consistency validation + confidence scoring
│   │   ├── task_generator.py    # Product-specific regulatory task lists
│   │   ├── autonomous_engine.py # CFPB poll + auto-process loop
│   │   └── learning.py          # Feedback/adaptation log
│   ├── data/
│   │   ├── database.py          # SQLite schema, CRUD, WAL mode
│   │   ├── cfpb_poller.py       # CFPB API client
│   │   ├── company_stats.py     # Company-level risk aggregation
│   │   └── loader.py            # CSV loading utilities
│   ├── models/
│   │   └── schemas.py           # Pydantic v2 I/O schemas for all agents
│   ├── services/
│   │   └── scheduler.py         # APScheduler background job management
│   └── utils/
│       ├── llm.py               # Anthropic SDK client, model routing
│       ├── prompts.py           # All LLM prompt templates
│       ├── slack.py             # Slack webhook sender
│       ├── email_sender.py      # Gmail SMTP delivery
│       ├── satisfaction_predictor.py  # CSAT prediction from dispute rates
│       ├── cost_calculator.py   # API cost estimation
│       ├── product_mapping.py   # CFPB product name canonicalization
│       └── report_generator.py  # Daily summary report
├── scripts/
│   ├── prepare_100k_dataset.py  # Sample and stratify 100K from full CFPB CSV
│   └── train_bayesian_model.py  # Fit PyMC model, save as bayesian_model.pkl
├── data/
│   ├── raw/                     # Full CFPB CSV (gitignored — 2-3GB)
│   └── processed/
│       ├── bayesian_model.pkl   # Trained PyMC posterior samples
│       ├── bayesian_results.json
│       ├── dataset_stats.json
│       ├── analysis_100k.csv
│       ├── bayesian_train_35k.csv
│       └── dev_set_10k.csv
├── tests/
│   └── test_pipeline.py
├── requirements.txt
├── .env.example
└── CLAUDE.md
```

---

## Limitations

- **Pipeline latency:** ~8–28 seconds is not real-time. Production would require async worker queues and cached model serving.
- **Product accuracy:** 88% reflects a zero-shot approach. Fine-tuning on CFPB labeled data would push this above 95%.
- **Issue accuracy:** 54% is constrained by label ambiguity in the CFPB taxonomy — 159 issue types with substantial semantic overlap.
- **Bayesian model is a static snapshot:** trained on a sample from 2024–2025. Needs periodic retraining as CFPB complaint patterns shift.
- **SQLite:** suitable for demo. Production requires PostgreSQL with connection pooling.
- **Single-threaded processing:** currently processes one complaint at a time. Production needs async workers and a message queue (Redis/Celery).
- **Event chain analysis is narrative pattern recognition:** the model traces what the consumer describes, not a formally verified causal graph. Outputs depend on narrative quality and completeness.
- **Regulatory risk scores are heuristic-based:** not validated against actual CFPB enforcement actions or legal precedent.
- **CSAT prediction uses dispute rates as proxies:** real satisfaction scores require direct consumer surveys.
- **Email uses a single Gmail account:** production would require SendGrid or AWS SES for deliverability, bounce handling, and volume.

---

## Future Roadmap

- Fine-tuned classification model (target: 95%+ product accuracy, 75%+ issue accuracy)
- Regulatory Risk Prediction Agent (validated against enforcement action history)
- Proactive Outreach Agent (contact consumers before complaints escalate)
- Churn Risk Agent (flag consumers likely to switch institutions)
- Semantic complaint search across case history
- Automated regulatory reporting (CFPB data submission format)
- Multi-channel ingest (email, web form, Salesforce, ServiceNow)
- Production deployment: PostgreSQL, Redis, Kubernetes, SendGrid

---

## Team

University of Maryland, College Park — 2026 UMD Agentic AI Challenge

- **Akhil Kambhatla** — MS Data Science
- **Hemanth Thulasiraman** — MS Data Science
- **Ravi Parvatham** — MS Machine Learning
- **Namratha Jeethendra** — MS Data Science

---

## Acknowledgments

- [2026 UMD Agentic AI Challenge](https://www.rhsmith.umd.edu/) — Robert H. Smith School of Business
- [CFPB Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/) — public data, updated daily
- [Anthropic](https://www.anthropic.com/) — Claude AI
- [PyMC](https://www.pymc.io/) — Bayesian inference

MIT License
