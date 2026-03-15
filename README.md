# 1Pager

### Turn your product ideas into professional 1-pagers in minutes

![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat-square&logo=langchain&logoColor=white)
![Anthropic](https://img.shields.io/badge/Anthropic-Claude-D97757?style=flat-square)
![Tavily](https://img.shields.io/badge/Tavily-Search-4A90E2?style=flat-square)
![OPIK](https://img.shields.io/badge/OPIK-Comet-FF6B35?style=flat-square)

---

## What is this?

A proof-of-concept AI agent built as a personal experiment by a PM who wanted to explore what it feels like to be a full product team of one.

The app was scaffolded and shipped across 6 sprints in 2–3 hours using **Claude Code** as a small product team — acting simultaneously as backend engineer, frontend engineer, UX designer, and PM. The goal was less about the product itself and more about the process: can a non-engineer PM ship a working, deployed, full-stack AI product from scratch?

The answer was yes.

---

## How it works

1. **Describe your initiative** — tell the agent what you're building in plain language
2. **Answer a few questions** — the agent asks up to 3 targeted clarifying questions to fill in the gaps
3. **Automatic market research** — the agent searches the web via Tavily for market size, trends, and competitors
4. **Get your 1-pager** — a structured PM document is generated and rendered in the chat
5. **Download it** — export as a Word doc (.docx) or PDF with one click
6. **Refine it** — ask the agent to sharpen any section and get an updated version instantly

Full trace observability on every request via **OPIK by Comet**.

---

## The stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18 + Vite | Vercel |
| Backend | Python 3.13 + FastAPI | Render |
| Agent | LangChain + Claude Haiku (Anthropic) | — |
| Web Research | Tavily Search API | — |
| Observability | OPIK by Comet | Comet Cloud |
| Uptime monitoring | UptimeRobot | — |

---

## The sprints

| Sprint | What was built |
|---|---|
| **Sprint 1** | Project scaffold — React + Vite frontend, FastAPI backend, hardcoded mock response end-to-end |
| **Sprint 2** | Real AI agent — LangChain + Claude Haiku, conversational session management, clarifying questions flow |
| **Sprint 3** | Web research — Tavily integration, 3 targeted market searches injected as context before generation |
| **Sprint 4** | Document generation — Word (.docx) and PDF export, in-memory file generation, download buttons |
| **Sprint 5** | Production deployment — Vercel + Render, API route fixes, environment-based config |
| **Sprint 6** | Observability — OPIK tracing, PII anonymizer, rule-based eval scoring (completeness, clarity, research usage) |

---

## How to run locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- API keys for Anthropic, Tavily, and OPIK (see [Environment variables](#environment-variables))

### 1. Clone the repo

```bash
git clone https://github.com/raulvallejo/pm-1pager-generator.git
cd pm-1pager-generator
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Create your .env file and fill in your API keys
cp .env.example .env
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install
```

Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

> The Vite dev server proxies `/api/*` requests to `localhost:8000` automatically — no CORS setup needed locally.

---

## Environment variables

Create a `backend/.env` file with the following:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key — powers the Claude Haiku agent |
| `TAVILY_API_KEY` | Yes | Your Tavily API key — used for the web research step |
| `OPIK_API_KEY` | No | Your OPIK / Comet API key — enables observability tracing |
| `OPIK_PROJECT_NAME` | No | Project name shown in the OPIK dashboard (default: `pm-1pager-generator`) |
| `OPIK_WORKSPACE` | No | Your OPIK workspace name (default: `default`) |
| `OPIK_URL_OVERRIDE` | No | OPIK cloud endpoint — set to `https://www.comet.com/opik/api` |

OPIK variables are optional — the app runs fully without them, tracing is simply skipped.

---

## Live demo

[pm-1pager-generator.vercel.app](https://pm-1pager-generator.vercel.app)

---

*Built as an experiment by a PM learning to be a Product Builder.*
