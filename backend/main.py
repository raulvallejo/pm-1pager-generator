from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PM 1-Pager Generator API")

# ---------------------------------------------------------------------------
# CORS — allow the React dev server (and Vercel) to call this API.
# In production you'd lock origins down to your Vercel domain.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# Pydantic models validate incoming JSON automatically and document the API.
# ---------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    message: str  # The user's product initiative description


class GenerateResponse(BaseModel):
    reply: str    # The assistant's response (hardcoded for Sprint 1)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def health_check():
    """Simple health-check so Railway knows the service is alive."""
    return {"status": "ok"}


@app.post("/generate", response_model=GenerateResponse)
def generate(request: GenerateRequest):
    """
    Sprint 1: returns a hardcoded mock response.
    Sprint 2+: this will call the LangChain agent with Claude.
    """
    mock_reply = (
        f"Got it! You want to build: \"{request.message}\". "
        "Here are my clarifying questions:\n\n"
        "1. Who is the primary user persona for this initiative?\n"
        "2. What is the target launch date?\n"
        "3. What does success look like (key metrics)?\n\n"
        "(This is a hardcoded mock response — the AI agent comes in Sprint 2.)"
    )
    return GenerateResponse(reply=mock_reply)
