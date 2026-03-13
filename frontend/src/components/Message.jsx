import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { downloadDoc } from "../api/client";

/**
 * Renders a single chat bubble.
 * Props:
 *   role:       "user" | "assistant"
 *   text:       string
 *   isDocument: boolean — true when the message is a completed PM 1-pager.
 *   sessionId:  string  — only present on document messages; used for downloads.
 */
export default function Message({ role, text, isDocument, sessionId }) {
  // Track loading state per format so each button shows its own spinner
  // independently — clicking "Word Doc" doesn't freeze the "PDF" button.
  const [downloading, setDownloading] = useState({ docx: false, pdf: false });
  const [downloadError, setDownloadError] = useState(null);

  async function handleDownload(format) {
    setDownloading((prev) => ({ ...prev, [format]: true }));
    setDownloadError(null);
    try {
      await downloadDoc(sessionId, format);
    } catch (err) {
      setDownloadError(`Download failed: ${err.message}`);
    } finally {
      setDownloading((prev) => ({ ...prev, [format]: false }));
    }
  }

  const classList = [
    "message",
    `message--${role}`,
    isDocument ? "message--document" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Label text — "You" for the user, "1-Pager" for completed documents,
  // "AI" for regular assistant messages.
  const label = role === "user" ? "You" : isDocument ? "1-Pager" : "AI";

  return (
    <div className={classList}>
      {/*
        message__header groups the avatar circle + sender label.
        It's only shown for assistant messages (user bubbles have no avatar).
      */}
      {role === "assistant" && (
        <div className="message__header">
          {/*
            Small circular avatar — a gradient circle with "AI" text inside.
            Pure CSS, no image file needed. The gradient matches the header
            (blue for assistant, green for completed 1-pager documents).
          */}
          <div className="message__avatar">AI</div>
          <span className="message__label">{label}</span>
        </div>
      )}

      {/* User bubbles get a plain label with no avatar */}
      {role === "user" && (
        <span className="message__label">{label}</span>
      )}

      <div className="message__text">
        {role === "user" ? (
          /*
            User messages: plain text with newlines preserved.
            We don't run user input through ReactMarkdown to keep it simple
            and avoid any unexpected rendering of markdown they might type.
          */
          text.split("\n").map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))
        ) : (
          /*
            Assistant messages: rendered as Markdown via react-markdown.
            This turns **bold**, # headings, - bullets, etc. into real HTML
            so the AI's structured output looks polished instead of showing
            raw asterisks and hashes.
          */
          <ReactMarkdown>{text}</ReactMarkdown>
        )}
      </div>

      {/* Download buttons — only shown on completed 1-pager documents */}
      {isDocument && sessionId && (
        <div className="download-buttons">
          <button
            className="download-btn download-btn--docx"
            onClick={() => handleDownload("docx")}
            disabled={downloading.docx || downloading.pdf}
          >
            {downloading.docx ? "Generating..." : "Download Word Doc"}
          </button>
          <button
            className="download-btn download-btn--pdf"
            onClick={() => handleDownload("pdf")}
            disabled={downloading.docx || downloading.pdf}
          >
            {downloading.pdf ? "Generating..." : "Download PDF"}
          </button>
          {downloadError && (
            <p className="download-error">{downloadError}</p>
          )}
        </div>
      )}
    </div>
  );
}
