import React, { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import InputForm from "./components/InputForm";
import { chatWithAgent, triggerResearch } from "./api/client";

// ---------------------------------------------------------------------------
// Session ID
//
// crypto.randomUUID() is built into all modern browsers (no library needed).
// We generate a fresh UUID as the lazy initialiser for useState — this runs
// once when the component first mounts, not on every render.
//
// The session ID is sent to the backend with every message so the backend
// knows which conversation history to look up and append to.
// ---------------------------------------------------------------------------

// A "message" object shape: { role: "user" | "assistant", text: string, isDocument?: boolean }

export default function App() {
  // Generate a new UUID on first render; changing this starts a new session.
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! Describe your product initiative and I'll ask you a few questions, then generate a PM 1-pager for you.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // -------------------------------------------------------------------------
  // handleSubmit — called when the user hits Send
  // -------------------------------------------------------------------------
  async function handleSubmit(userText) {
    // 1. Show the user's message immediately (optimistic update)
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsLoading(true);

    try {
      // 2. Call the backend /chat endpoint.
      //    Returns either a clarifying question (normal turn) or
      //    isResearching=true when Claude has enough info to proceed.
      const { reply, isComplete, isResearching } = await chatWithAgent(sessionId, userText);

      if (isResearching) {
        // 3a. Show the "Researching..." message in the chat immediately so
        //     the user knows something is happening during the Tavily calls.
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: reply },
        ]);

        // 3b. Auto-fire the /research call — no user action needed.
        //     isLoading stays true the whole time, keeping the input disabled.
        const { reply: docReply, isComplete: docComplete } = await triggerResearch(sessionId);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: docReply, isDocument: docComplete },
        ]);
      } else {
        // 3c. Normal clarifying question or direct 1-pager.
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: reply, isDocument: isComplete },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error: ${err.message}. Is the backend running?`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // handleNewInitiative — resets the conversation
  //
  // Generating a new UUID means the backend will create a fresh history list
  // the next time the user sends a message. The old session stays in memory
  // on the server but is simply no longer referenced.
  // -------------------------------------------------------------------------
  function handleNewInitiative() {
    setSessionId(crypto.randomUUID());
    setMessages([
      {
        role: "assistant",
        text: "Hi! Describe your product initiative and I'll ask you a few questions, then generate a PM 1-pager for you.",
      },
    ]);
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>PM 1-Pager Generator</h1>
        <button
          className="new-initiative-btn"
          onClick={handleNewInitiative}
          disabled={isLoading}
          title="Start a new conversation"
        >
          New Initiative
        </button>
      </header>

      <main className="app-main">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <InputForm onSubmit={handleSubmit} isLoading={isLoading} />
      </main>
    </div>
  );
}
