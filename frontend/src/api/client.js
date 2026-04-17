// Base URL:
//   - In local dev: empty string → Vite proxy rewrites /api/* → localhost:8000
//   - In production: VITE_API_BASE_URL is set to the Railway URL in Vercel
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Send a message to the LangChain/Claude agent and get a reply.
 *
 * @param {string} sessionId  - UUID that identifies this conversation thread.
 *                              The backend uses it to look up conversation history.
 * @param {string} message    - The user's latest message.
 * @returns {Promise<{reply: string, sessionId: string, isComplete: boolean}>}
 *   reply       - Claude's text response (a question or the final 1-pager)
 *   sessionId   - Echoed back from the server (same value you sent)
 *   isComplete  - true when Claude returned the final 1-pager document
 */
export async function chatWithAgent(sessionId, message) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });

  if (!response.ok) {
    // Try to surface the server's error message if available
    let detail = `Server responded with ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) detail = err.detail;
    } catch (_) {}
    throw new Error(detail);
  }

  const data = await response.json();
  return {
    reply: data.reply,
    sessionId: data.session_id,
    isComplete: data.is_complete,
    isResearching: data.is_researching,
  };
}

/**
 * Sprint 3: trigger Tavily market research + 1-pager generation.
 *
 * Called automatically by App.jsx when chatWithAgent returns isResearching=true.
 * Sends the session_id so the backend knows which conversation to research.
 * Returns the enriched 1-pager once Tavily searches + Claude generation finish.
 *
 * @param {string} sessionId
 * @returns {Promise<{reply: string, sessionId: string, isComplete: boolean}>}
 */
export async function triggerResearch(sessionId) {
  const response = await fetch(`${BASE_URL}/api/research-a2a`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    let detail = `Server responded with ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) detail = err.detail;
    } catch (_) {}
    throw new Error(detail);
  }

  const data = await response.json();
  return {
    reply: data.reply,
    sessionId: data.session_id,
    isComplete: data.is_complete,
    traceId: data.trace_id ?? null,
  };
}

/**
 * Sprint 4: download the 1-pager as a Word doc or PDF.
 *
 * How browser file downloads work via fetch:
 *   1. POST to the backend — it returns raw binary bytes (not JSON).
 *   2. response.blob() reads those bytes into a Blob object.
 *   3. URL.createObjectURL(blob) creates a temporary in-browser URL for it.
 *   4. We create a hidden <a> tag pointing to that URL with a `download`
 *      attribute, click it programmatically, then clean up.
 *
 * @param {string} sessionId
 * @param {"docx"|"pdf"} format
 */
export async function downloadDoc(sessionId, format) {
  const response = await fetch(`${BASE_URL}/api/download/${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    let detail = `Download failed (${response.status})`;
    try {
      const err = await response.json();
      if (err.detail) detail = err.detail;
    } catch (_) {}
    throw new Error(detail);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pm-1pager.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // free the temporary URL from browser memory
}

/**
 * Fire-and-forget feedback signal to log download/regenerate events as OPIK satisfaction scores.
 * Errors are swallowed — feedback failures must never surface to the user.
 *
 * @param {string} traceId   - OPIK trace_id returned by /api/research
 * @param {"download"|"regenerate"} eventType
 */
export async function sendFeedback(traceId, eventType) {
  try {
    await fetch(`${BASE_URL}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trace_id: traceId, event_type: eventType }),
    });
  } catch (_) {
    // fire-and-forget — don't surface feedback errors to the user
  }
}

/**
 * Sprint 1 legacy function — kept so the old /generate path still compiles.
 * The app now uses chatWithAgent instead.
 */
export async function generateResponse(message) {
  const response = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }

  const data = await response.json();
  return data.reply;
}
