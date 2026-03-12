import React, { useState } from "react";

/**
 * Text input form with a submit button.
 * Props:
 *   onSubmit: (text: string) => void
 *   isLoading: boolean
 */
export default function InputForm({ onSubmit, isLoading }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault(); // Prevent the browser's default form submission (page reload)
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setValue(""); // Clear the input after sending
  }

  // Allow Shift+Enter for newlines, Enter alone to submit
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSubmit(e);
    }
  }

  return (
    <form className="input-form" onSubmit={handleSubmit}>
      <textarea
        className="input-form__textarea"
        rows={3}
        placeholder="Describe your product initiative..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
      />
      <button
        type="submit"
        className="input-form__button"
        disabled={isLoading || !value.trim()}
      >
        {isLoading ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
