import React from "react";

/**
 * Renders a single chat bubble.
 * Props:
 *   role:       "user" | "assistant"
 *   text:       string
 *   isDocument: boolean — true when the message is a completed PM 1-pager.
 *               Adds the "message--document" CSS class for distinct styling.
 */
export default function Message({ role, text, isDocument }) {
  const classList = [
    "message",
    `message--${role}`,
    isDocument ? "message--document" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classList}>
      <span className="message__label">
        {role === "user" ? "You" : isDocument ? "1-Pager" : "Assistant"}
      </span>
      {/* Split on newlines so multi-line / markdown-ish responses render correctly */}
      <p className="message__text">
        {text.split("\n").map((line, i, arr) => (
          <React.Fragment key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}
