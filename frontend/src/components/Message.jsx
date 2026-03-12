import React from "react";

/**
 * Renders a single chat bubble.
 * Props:
 *   role: "user" | "assistant"
 *   text: string
 */
export default function Message({ role, text }) {
  return (
    <div className={`message message--${role}`}>
      <span className="message__label">{role === "user" ? "You" : "Assistant"}</span>
      {/* Split on newlines so multi-line responses render correctly */}
      <p className="message__text">
        {text.split("\n").map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < text.split("\n").length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}
