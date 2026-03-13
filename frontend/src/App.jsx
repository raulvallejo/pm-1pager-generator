import React, { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import InputForm from "./components/InputForm";
import { chatWithAgent, triggerResearch } from "./api/client";

// A "message" object shape:
// { role: "user"|"assistant", text: string, isDocument?: boolean, sessionId?: string }
// sessionId is set on document messages so Message.jsx can call /download/* endpoints.

export default function App() {
  // Generate a new UUID on first render; changing this starts a new session.
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! Describe your product initiative and I'll ask you a few clarifying questions, then generate a professional PM 1-pager for you.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // isResearchingPhase is true while Tavily web research is running.
  // ChatWindow uses this to show a "Researching the web..." indicator
  // separately from the generic typing dots (which show during LLM calls).
  const [isResearchingPhase, setIsResearchingPhase] = useState(false);

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
        // 3a. Show the agent's transition message (e.g. "Great, I have what I need…")
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: reply },
        ]);

        // 3b. Switch to researching phase — ChatWindow shows the amber indicator.
        setIsResearchingPhase(true);

        // 3c. Auto-fire the /research call — no user action needed.
        //     isLoading stays true the whole time, keeping the input disabled.
        const { reply: docReply, isComplete: docComplete } = await triggerResearch(sessionId);

        // 3d. Research done — hide the indicator and show the final document.
        setIsResearchingPhase(false);
        setMessages((prev) => [
          ...prev,
          // Include sessionId so the download buttons in Message.jsx know
          // which session to request the file for.
          { role: "assistant", text: docReply, isDocument: docComplete, sessionId },
        ]);
      } else {
        // 3e. Normal clarifying question or direct 1-pager.
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: reply, isDocument: isComplete, sessionId: isComplete ? sessionId : undefined },
        ]);
      }
    } catch (err) {
      setIsResearchingPhase(false);
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
    setIsResearchingPhase(false);
    setMessages([
      {
        role: "assistant",
        text: "Hi! Describe your product initiative and I'll ask you a few clarifying questions, then generate a professional PM 1-pager for you.",
      },
    ]);
  }

  return (
    <div className="app-container">
      {/*
        Header — gradient background (styled in index.css).
        Left side: logo emoji + "1Pager" title + tagline subtitle.
        Right side: "New Initiative" ghost button.
      */}
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__title-row">
            {/* Logo emoji — gives the header a visual anchor without needing an image file */}
            <span className="app-header__logo">📄</span>
            <h1>1Pager</h1>
          </div>
          {/* Tagline — small muted text below the app name */}
          <span className="app-header__tagline">
            Turn your product ideas into professional 1-pagers in minutes
          </span>
        </div>

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
        {/*
          Pass isResearchingPhase so ChatWindow can show the amber
          "Researching the web..." bubble during the Tavily phase,
          distinct from the blue typing dots during regular LLM calls.
        */}
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          isResearchingPhase={isResearchingPhase}
        />
        <InputForm onSubmit={handleSubmit} isLoading={isLoading} />
      </main>
    </div>
  );
}
