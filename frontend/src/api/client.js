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
  };
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
