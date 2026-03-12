import React, { useState } from "react";
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

  return (
    <div className={classList}>
      <span className="message__label">
        {role === "user" ? "You" : isDocument ? "1-Pager" : "Assistant"}
      </span>

      <p className="message__text">
        {text.split("\n").map((line, i, arr) => (
          <React.Fragment key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>

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
