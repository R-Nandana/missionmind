# MissionMind 🚀

**Evidence-Grounded Space Mission Anomaly & Knowledge Intelligence Platform**

MissionMind helps planetary scientists detect, explain, and cross-reference anomalous observations from the Mars 2020 / Perseverance rover's MEDA instrument. Every score is computed by code; the LLM only explains structured results and must cite its evidence.

## Architecture

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│   React/Vite │─────▶│  Node/Express    │─────▶│  Python FastAPI     │
│   Frontend   │      │  Backend         │      │  Analysis Service   │
│  :5173       │      │  :3001           │      │  :8000              │
└──────────────┘      │  • Auth (JWT)    │      │  • Anomaly (z-score)│
                      │  • Observations  │      │  • Similarity       │
                      │  • MongoDB Atlas │      │  • RAG (BM25+vec)   │
                      └──────────────────┘      │  • LLM explanation  │
                                                └─────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB Atlas account (free tier)
- OpenAI API key (optional; enables generated explanations)

### 1. Clone and configure
```bash
cp .env.example .env
# Edit .env with your MongoDB URI and OpenAI key
```

### 2. Analysis Service (Python)
```bash
cd analysis-service
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Generate synthetic MEDA data and ingest documents
python scripts/generate_meda_data.py
python scripts/ingest_docs.py
python scripts/seed_events.py

# Start
uvicorn app.main:app --reload --port 8000
```

### 3. Backend (Node)
```bash
cd backend
npm install
npm run seed     # seed missions + instruments into MongoDB
npm run dev      # starts on :3001
```

### 4. Frontend (React)
```bash
cd frontend
npm install
npm run dev      # starts on :5173
```

### 5. Evaluation
```bash
cd evaluation
python scripts/eval_anomaly.py
python scripts/eval_retrieval.py
python scripts/eval_faithfulness.py
```

## Cloud Deployment

### 1. Backend on Render (FastAPI + Node API)
Click below to deploy the backend services to Render via Blueprint:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://dashboard.render.com/blueprints/new?repo=https%3A%2F%2Fgithub.com%2FR-Nandana%2Fmissionmind)

- Direct link: [Render Blueprint Deployment](https://dashboard.render.com/blueprints/new?repo=https%3A%2F%2Fgithub.com%2FR-Nandana%2Fmissionmind)
- Render will automatically provision `missionmind-api` and `missionmind-analysis`.
- Enter your `MONGODB_URI` when prompted (or let it use the resilient in-memory database).
- Once deployed, copy your backend URL: `https://missionmind-api.onrender.com`.

### 2. Frontend on Vercel (React / Vite)
Click below to deploy the frontend to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FR-Nandana%2Fmissionmind&root-directory=frontend&env=VITE_API_URL&project-name=missionmind-web)

- Direct link: [Vercel 1-Click Deploy](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FR-Nandana%2Fmissionmind&root-directory=frontend&env=VITE_API_URL&project-name=missionmind-web)
- Set `VITE_API_URL` to `https://missionmind-api.onrender.com/api` (your Render backend URL).
- Vercel will automatically build the Vite application and apply the SPA routes from [`frontend/vercel.json`](frontend/vercel.json).


## Scope
- **Mission**: Mars 2020 / Perseverance
- **Instrument**: MEDA (temperature + pressure)
- **Sols**: 1–100 (synthetic data modeled on real MEDA characteristics)
- **Documents**: 25 curated docs on MEDA, Mars atmosphere, Jezero Crater

## API Contract

`POST /analyze` — see [analysis-service/README.md](analysis-service/README.md)

## Evaluation Metrics
| Category   | Metrics                        |
|------------|--------------------------------|
| Anomaly    | Precision, Recall, F1          |
| Retrieval  | Precision@5, MRR               |
| RAG        | Faithfulness (claim→chunk map) |

## Non-negotiable Rules
1. All numerical scores computed by code, never by the LLM.
2. LLM must cite chunk IDs in its explanation.
3. If retrieval is weak → `"insufficient_evidence"`, never hallucinate.
4. Scores labeled "anomaly score", not "confidence".
