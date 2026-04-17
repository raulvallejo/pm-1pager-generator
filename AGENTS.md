# AGENTS.md — PM 1-Pager Generator

This file gives AI coding agents (Claude Code, Cursor, etc.) persistent context
about this project. Read it before making any changes.

---

## Project overview

A production AI agent that turns rough product ideas into structured PM 1-pagers
through a multi-turn conversation. Users describe an initiative, the agent asks
up to 3 clarifying questions, runs market research via Tavily, then generates a
structured 1-pager using Claude Haiku.

**Live URLs**
- Frontend: https://pm-1pager-generator.vercel.app
- Backend: https://pm-1pager-generator.onrender.com

---

## Architecture

```
frontend/          React + Vite — deployed on Vercel
backend/           FastAPI — deployed on Render
```

The frontend calls the backend via `/api/*` endpoints. In production, the
frontend's `VITE_API_URL` points to the Render URL. In local dev, it points
to `http://localhost:8000`.

**Request flow:**
```
User message
  → POST /api/chat        (clarification loop)
  → POST /api/research    (Tavily search + 1-pager generation)
  → POST /api/download/*  (docx or pdf export)
```

---

## Backend — key files

```
backend/
  main.py              Single file — all endpoints, logic, helpers
  test_guardrails.py   Pytest suite — 26 test cases for the guardrail system
  Procfile             Render start command: uvicorn main:app
  .env                 Local env vars (never commit)
  requirements.txt     Pinned dependencies — always update after pip install
```

---

## Backend — core pipeline

### 1. Clarification (`/api/chat`)
- Appends user message to session history
- Runs guardrail checks (see Guardrail system below)
- Calls Claude Haiku via LangChain with `ACTIVE_SYSTEM_PROMPT`
- Detects `[READY_FOR_RESEARCH]` signal → returns `is_researching: true`
- Frontend immediately fires `/api/research` when it sees this flag

### 2. Research + generation (`/api/research`)
- Calls `generate_1pager_pipeline()` — the top-level OPIK trace
- Child span 1: `track_web_research()` — 3 Tavily searches (market size, trends, competitors)
- Child span 2: `track_1pager_generation()` — Claude Haiku generates the 1-pager
- Returns the 1-pager markdown + `trace_id` for feedback logging

### 3. Download (`/api/download/docx`, `/api/download/pdf`)
- Reads from `session_documents[session_id]`
- Parses markdown with `parse_1pager()` → generates file in memory
- Returns `StreamingResponse` — no disk writes

---

## A2A Client

This agent now acts as an A2A client — it calls Market Scout as an external
research agent via the A2A protocol instead of running its own Tavily searches.

**Market Scout endpoints:**
- Agent Card: `https://market-scout-405j.onrender.com/.well-known/agent.json`
- A2A task endpoint: `https://market-scout-405j.onrender.com/a2a/tasks/send`

**`call_market_scout_a2a(query, session_id)`**
- Sends an A2A task to Market Scout with the given query
- Extracts and returns the text result from the response
- 60-second timeout
- Fails gracefully: returns empty string on any error (timeout, non-200, bad JSON,
  missing fields) — the pipeline continues with empty research rather than crashing

**`POST /api/research-a2a`**
- Same request/response format as `/api/research`
- Uses `call_market_scout_a2a()` for market research instead of internal Tavily searches
- Existing `/api/research` endpoint is unchanged — Tavily research still works as before

**OPIK instrumentation:**
- A2A HTTP call tracked as a span with `name="a2a_research_call"`
- Full pipeline tracked as a span with `name="a2a_pipeline"`
- Use `_safe_track` wrapper — same pattern as all other spans

**Critical rule:** if Market Scout is down or returns an error, the pipeline
continues with empty research rather than crashing. Never let A2A failure
propagate as an exception to the caller.

**Production status:**
- A2A pipeline tested end-to-end in production — working correctly
- `/api/research-a2a` is live at `https://pm-1pager-generator.onrender.com/api/research-a2a`
- Frontend updated — `triggerResearch` in `frontend/src/api/client.js` now calls `/api/research-a2a` instead of `/api/research`
- The 1-Pager Generator UI now uses Market Scout via A2A as the sole research source — Tavily internal research is no longer called from the frontend
- `/api/research` endpoint still exists as a fallback but is not used by the UI

**Known gotcha — clarification loop bypass:**
The endpoint must seed the query as the first user message AND append
`{"role": "assistant", "content": "[READY_FOR_RESEARCH]"}` to the session
history before calling generation — otherwise Claude enters the clarification
loop instead of generating.

`generate_1pager_a2a_pipeline()` bypasses `track_1pager_generation()` entirely
and calls the LLM directly with a generation-specific system prompt — this
avoids the clarification loop in the main system prompt.

---

## Backend — OPIK instrumentation

OPIK is configured **entirely via environment variables**. Never call `opik.configure()` — it triggers an interactive TTY prompt that crashes on Render.

**Required env vars:**
```
OPIK_API_KEY
OPIK_PROJECT_NAME
OPIK_WORKSPACE
OPIK_URL_OVERRIDE   (if using self-hosted)
```

**Tracking pattern — always use `_safe_track`:**
```python
@_safe_track(name="my_span", type="llm")
def my_function():
    ...
```

`_safe_track` wraps `opik.track()` in a try/except. If OPIK fails at decoration
time (bad key, network issue), the function runs untracked instead of crashing.

**Updating span metadata inside a tracked function:**
```python
# CORRECT
opik.opik_context.update_current_span(metadata={...})

# WRONG — will throw AttributeError silently
opik.opontext.update_current_span(metadata={...})
```

Always wrap span updates in try/except — they should never crash the main flow.

**Token usage logging:**
Use `_invoke_with_usage()` instead of `invoke_with_backoff()` when you need
token counts and cost logged to OPIK. It captures `usage_metadata` from the
LangChain response and updates the current span.

---

## Backend — guardrail system

Three layers run on every request before Claude sees or returns anything.

### Layer 1 — Scope filter (turn 1 only)
```python
guardrail_input_validation(user_input)
```
- Runs only when `len(history) == 0` (first message)
- Uses Groq (Llama 3, free tier) — ~20ms, $0
- Blocks: prompt injections, non-PM topics, harmful requests, gibberish
- Returns: `("PASS", reason)` or `("BLOCK", reason)`

### Layer 2 — Injection check (turns 2+)
```python
guardrail_injection_check(user_input)
```
- Runs on every subsequent message
- Same model (Groq, Llama 3, free)
- Only blocks clear injection attempts — short replies like "no", "Q3" always pass
- Returns: `("PASS", reason)` or `("BLOCK", reason)`

### Layer 3 — Output checks (post-generation)
```python
guardrail_output_toxicity(output)   # Groq, free
guardrail_quality_gate(output)      # rule-based via score_1pager()
```
- Toxicity: Groq scan on first 1000 chars of generated output
- Quality gate: scores completeness, research_usage, clarity — threshold 0.6
- Below threshold → one automatic retry, then best-effort return

**Groq client safety net:**
```python
# If GROQ_API_KEY is missing, _groq_client is None
# _groq_check() returns "PASS" by default — agent keeps working
# Guardrail layer silently disabled, not a crash
```

**Test suite:** `test_guardrails.py` — always run before deploying guardrail changes:
```bash
pytest test_guardrails.py -v
```
All 26 tests must pass. Zero false positives on G1-T01 and G1-T13.

---

## Backend — session management

Sessions are in-memory dicts — they reset on server restart:
```python
sessions: dict[str, list[dict]]        # conversation history
session_research: dict[str, str]       # Tavily research summary
session_documents: dict[str, str]      # generated 1-pager markdown
```

Session IDs are UUIDs generated by the frontend. The backend never generates them.

---

## Backend — LLM setup

```python
llm = ChatAnthropic(model="claude-haiku-4-5")
```

- Reads `ANTHROPIC_API_KEY` from environment automatically
- `invoke_with_backoff()` — retries up to 3 times on rate limit (2s, 4s, 8s)
- `_invoke_with_usage()` — same + captures token counts and estimated cost

**System prompt:**
- Hardcoded in `SYSTEM_PROMPT` as fallback
- Fetched from OPIK Prompt Library at startup as `ACTIVE_SYSTEM_PROMPT`
- If OPIK fetch fails, falls back to hardcoded version silently

---

## Frontend — key files

```
frontend/src/
  App.jsx              Main app — session management, API calls, chat state
  api/client.js        API client — all fetch calls to backend
  components/
    ChatWindow.jsx     Message list + scroll behavior
    Message.jsx        Individual message rendering (detects 1-pager markdown)
    InputForm.jsx      Text input + send button
```

**API base URL:**
```javascript
// Set in .env.production for Vercel
VITE_API_URL=https://pm-1pager-generator.onrender.com
```

---

## Deployment

### Backend (Render)
- Auto-deploys on push to `main`
- Python version: 3.14 (important — some packages need pre-built wheels)
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- All secrets set as env vars in Render dashboard — never in code

### Frontend (Vercel)
- Auto-deploys on push to `main`
- Build command: `npm run build`
- Output: `dist/`

---

## Environment variables

### Backend (Render + local .env)
```
ANTHROPIC_API_KEY       Claude Haiku
TAVILY_API_KEY          Market research searches
OPIK_API_KEY            Observability platform
OPIK_PROJECT_NAME       pm-1pager-generator
OPIK_WORKSPACE          ra-l-vallejo
GROQ_API_KEY            Guardrail checks (free tier)
```

### Frontend (Vercel + local .env.production)
```
VITE_API_URL            Backend base URL
```

---

## Critical rules — never do these

- **Never call `opik.configure()`** — crashes on Render (no TTY)
- **Never hardcode API keys** — use env vars only
- **Never write files to disk** — use `io.BytesIO` for downloads
- **Never change the session ID logic** — frontend generates UUIDs, backend never does
- **Never pin `pydantic_core` in requirements.txt** — causes Render build failures on Python 3.14
- **Always run `pytest test_guardrails.py -v` before deploying guardrail changes**
- **Always update `requirements.txt` after `pip install`** — Render uses it on every deploy

---

## Known quirks

- `opik.opik_context.update_current_span()` — correct path (not `opik.opontext`)
- `total_cost` only renders in OPIK UI when span type is explicitly set to `llm`
- Groq client initializes to `None` if `GROQ_API_KEY` is missing — guardrails silently pass through
- Render runs Python 3.14 — avoid packages that require Rust compilation from source
- `pip freeze` on Mac captures platform-specific packages — use a minimal `requirements.txt` instead

---

## Testing

```bash
# Run guardrail test suite
cd backend
source .venv/bin/activate
pytest test_guardrails.py -v

# Run specific layer
pytest test_guardrails.py -k "G1" -v   # input validation
pytest test_guardrails.py -k "G2" -v   # output toxicity
pytest test_guardrails.py -k "G3" -v   # quality gate
```

---

## Stack

| Layer | Technology |
|---|---|
| LLM | Claude Haiku (Anthropic) |
| Guardrails | Groq — Llama 3 (free tier) |
| Orchestration | LangChain |
| Backend | FastAPI + Python |
| Research | Tavily |
| Observability | OPIK by Comet |
| Frontend | React + Vite |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Testing | pytest |
