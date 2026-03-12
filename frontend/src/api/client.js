// Base URL:
//   - In local dev: empty string, so fetch("/api/generate") hits the Vite proxy → localhost:8000
//   - In production: VITE_API_BASE_URL is set to the Railway URL in Vercel's dashboard
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Sends the user's message to the backend and returns the assistant's reply.
 * @param {string} message
 * @returns {Promise<string>}
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
