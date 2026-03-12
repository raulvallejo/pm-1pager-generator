import React, { useEffect, useRef } from "react";
import Message from "./Message";

/**
 * Renders the scrollable list of chat messages.
 * Props:
 *   messages: Array<{ role: string, text: string }>
 *   isLoading: boolean
 */
export default function ChatWindow({ messages, isLoading }) {
  // Auto-scroll to the bottom whenever a new message is added
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-window">
      {messages.map((msg, index) => (
        <Message key={index} role={msg.role} text={msg.text} isDocument={msg.isDocument} />
      ))}

      {/* Typing indicator shown while waiting for the backend */}
      {isLoading && (
        <div className="message message--assistant">
          <span className="message__label">Assistant</span>
          <p className="message__text typing-indicator">Thinking...</p>
        </div>
      )}

      {/* Invisible anchor element — we scroll this into view */}
      <div ref={bottomRef} />
    </div>
  );
}
