import os
import time
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# ---------------------------------------------------------------------------
# Load environment variables from backend/.env
# This makes ANTHROPIC_API_KEY available via os.environ.
# langchain-anthropic reads ANTHROPIC_API_KEY automatically.
# ---------------------------------------------------------------------------
load_dotenv()

app = FastAPI(title="PM 1-Pager Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Claude client via LangChain
#
# ChatAnthropic reads ANTHROPIC_API_KEY from the environment.
# We create ONE shared instance at startup — it's thread-safe.
# ---------------------------------------------------------------------------
llm = ChatAnthropic(model="claude-haiku-4-5")

# ---------------------------------------------------------------------------
# Exponential backoff helper
#
# Retries the Claude call up to MAX_RETRIES times when a rate limit error
# is detected. Waits 2^attempt seconds between tries (2s, 4s, 8s).
# All other errors are re-raised immediately without retrying.
# ---------------------------------------------------------------------------
MAX_RETRIES = 3

def invoke_with_backoff(messages: list) -> str:
    for attempt in range(MAX_RETRIES):
        try:
            return llm.invoke(messages).content
        except Exception as e:
            err = str(e).lower()
            is_rate_limit = "quota" in err or "429" in err or "rate" in err
            if is_rate_limit and attempt < MAX_RETRIES - 1:
                wait = 2 ** (attempt + 1)  # 2s, 4s, 8s
                time.sleep(wait)
                continue
            raise  # not a rate limit, or all retries exhausted — bubble up

# ---------------------------------------------------------------------------
# In-memory session store
#
# sessions is a plain Python dict:
#   key   → session_id  (a UUID string the frontend generates and sends)
#   value → list of message dicts, e.g. [{"role": "user", "content": "..."}]
#
# The Anthropic API is *stateless* — every call must include the full
# conversation history. We store that history here, keyed by session_id.
#
# Limitation: sessions disappear when the server restarts. Sprint 3 can
# add a real database (Redis, Postgres) if persistence is needed.
# ---------------------------------------------------------------------------
sessions: dict[str, list[dict]] = {}

# ---------------------------------------------------------------------------
# System prompt
#
# This is the "personality and rules" message sent to Claude on every call.
# It is NOT stored in the session history — Anthropic's API accepts it as a
# separate `system` parameter alongside the `messages` list.
#
# The prompt does three things:
#   1. Defines the agent's role
#   2. Prescribes the workflow (ask ≤3 questions, then produce the 1-pager)
#   3. Specifies the exact output format for the 1-pager so we can detect it
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
You are a Product Management assistant that helps teams turn rough ideas into
structured PM 1-pagers.

WORKFLOW
--------
1. The user describes a product initiative (may be vague or detailed).
2. You analyse it and identify the single most important piece of missing
   information.
3. You ask ONE clarifying question per response — maximum 3 questions total.
4. After at most 3 questions (or sooner if the description is already
   detailed), you produce the final PM 1-pager.

RULES
-----
- Ask EXACTLY ONE question per turn. Never bundle multiple questions.
- After 3 questions you MUST produce the 1-pager even if you wish you had
  more information — make reasonable assumptions and note them in the
  Risks & Assumptions section.
- If the user's initial message is already detailed enough, skip questions
  and go straight to the 1-pager.
- NEVER produce both a clarifying question and the 1-pager in the same
  response. It is always one or the other.

1-PAGER FORMAT
--------------
When you are ready to produce the document, your ENTIRE response must be this
markdown (fill in the brackets):

---
## PM 1-Pager: [Initiative Name]

### Problem Statement
[What problem are we solving, for whom, and why does it matter now?]

### Target User
[Specific user persona — role, context, key pain point]

### Proposed Solution
[What we are building and the core user experience in 2-3 sentences]

### Key Metrics
[2–4 measurable success indicators; include targets where possible]

### Risks & Assumptions
[Top 3 risks or assumptions that could invalidate this initiative]
---

IMPORTANT: when producing the 1-pager, start your response with the exact
line "---" (three dashes, nothing else on that line) so the frontend can
detect it and render it as a document.
"""


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: str   # UUID generated by the frontend; identifies this convo
    message: str      # The user's latest message


class ChatResponse(BaseModel):
    reply: str        # Claude's response (question or 1-pager)
    session_id: str   # Echoed back so the frontend can confirm/store it
    is_complete: bool # True when Claude returned the final 1-pager


# ---------------------------------------------------------------------------
# /chat endpoint
#
# Flow on each call:
#   1. Look up (or create) the session's history list.
#   2. Append the new user message.
#   3. Send [system_prompt + full history] to Claude.
#   4. Append Claude's reply to history.
#   5. Return the reply to the frontend.
#
# Claude sees the entire conversation every time — that's what makes the
# follow-up questions feel coherent. The `system` parameter tells Claude who
# it is; `messages` is the actual back-and-forth.
# ---------------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    # 1. Get or create the session's history
    if request.session_id not in sessions:
        sessions[request.session_id] = []

    history = sessions[request.session_id]

    # 2. Append the user's message to the running history
    history.append({"role": "user", "content": request.message})

    # 3. Call Claude via LangChain
    #    LangChain uses typed message objects instead of raw dicts:
    #      SystemMessage  → the system prompt (sent once, before history)
    #      HumanMessage   → user turns
    #      AIMessage      → assistant turns
    #    We build the full message list fresh on every call so Claude has
    #    the complete conversation context.
    lc_messages = [SystemMessage(content=SYSTEM_PROMPT)]
    for msg in history:
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=msg["content"]))
        else:
            lc_messages.append(AIMessage(content=msg["content"]))

    try:
        # invoke_with_backoff retries up to 3 times on rate limit errors
        # before raising, so transient 429s are handled transparently.
        reply = invoke_with_backoff(lc_messages)
    except Exception as e:
        err = str(e).lower()
        if "api key" in err or "credential" in err or "401" in err or "authentication" in err:
            raise HTTPException(status_code=401, detail="Invalid ANTHROPIC_API_KEY.")
        if "quota" in err or "429" in err or "rate" in err or "overloaded" in err:
            raise HTTPException(status_code=429, detail="Anthropic rate limit hit — all retries exhausted.")
        raise HTTPException(status_code=503, detail=f"Could not reach Anthropic API: {e}")

    # 4. Append the assistant reply so the next call includes it as context
    history.append({"role": "assistant", "content": reply})

    # 5. Detect whether this is the final 1-pager (starts with "---")
    #    The frontend uses this flag to apply different styling.
    is_complete = reply.strip().startswith("---")

    return ChatResponse(
        reply=reply,
        session_id=request.session_id,
        is_complete=is_complete,
    )


# ---------------------------------------------------------------------------
# Legacy /generate endpoint (Sprint 1 — kept so nothing breaks)
# ---------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    message: str


class GenerateResponse(BaseModel):
    reply: str


@app.post("/generate", response_model=GenerateResponse)
def generate(request: GenerateRequest):
    """Sprint 1 mock endpoint — still works but /chat is the real one now."""
    mock_reply = (
        f"[Legacy /generate] Got: \"{request.message}\". "
        "Please use the /chat endpoint instead."
    )
    return GenerateResponse(reply=mock_reply)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {"status": "ok"}
