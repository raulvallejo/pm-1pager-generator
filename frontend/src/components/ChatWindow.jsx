import React, { useEffect, useRef } from "react";
import Message from "./Message";

/**
 * Renders the scrollable list of chat messages.
 * Props:
 *   messages:           Array<{ role, text, isDocument?, sessionId? }>
 *   isLoading:          boolean — true while any backend call is in flight
 *   isResearchingPhase: boolean — true specifically during Tavily web research
 */
export default function ChatWindow({ messages, isLoading, isResearchingPhase }) {
  // Auto-scroll to the bottom whenever messages change or loading state changes
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="chat-window">
      {messages.map((msg, index) => (
        <Message
          key={index}
          role={msg.role}
          text={msg.text}
          isDocument={msg.isDocument}
          sessionId={msg.sessionId}
        />
      ))}

      {/*
        Research indicator — shown during the Tavily web search phase.
        Displayed INSTEAD of the typing dots so the user knows something
        more specific is happening (not just "thinking").
        The amber color palette visually distinguishes it from the blue
        assistant bubbles.
      */}
      {isResearchingPhase && (
        <div className="message message--assistant">
          <div className="message__header">
            <div className="message__avatar">AI</div>
            <span className="message__label">AI</span>
          </div>
          <div className="researching-bubble">
            <div className="researching-spinner" />
            Researching the web for market data…
          </div>
        </div>
      )}

      {/*
        Typing indicator — three animated dots shown while the LLM is thinking.
        Only shown when loading AND not in the research phase (during research
        the amber indicator above takes over).
        Each .typing-dot is a small circle animated with @keyframes typing-bounce,
        staggered by 0.2s so they wave in sequence rather than bouncing together.
      */}
      {isLoading && !isResearchingPhase && (
        <div className="message message--assistant">
          <div className="message__header">
            <div className="message__avatar">AI</div>
            <span className="message__label">AI</span>
          </div>
          <div className="typing-bubble">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      )}

      {/* Invisible anchor element — we scroll this into view */}
      <div ref={bottomRef} />
    </div>
  );
}
