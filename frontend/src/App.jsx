import React, { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import InputForm from "./components/InputForm";
import { generateResponse } from "./api/client";

// A "message" object has the shape: { role: "user" | "assistant", text: string }

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! Describe your product initiative and I'll help you build a 1-pager.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(userText) {
    // 1. Append the user's message to the chat immediately (optimistic update)
    const userMessage = { role: "user", text: userText };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 2. Call the backend
      const reply = await generateResponse(userText);

      // 3. Append the assistant's reply
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Error: could not reach the server. Is the backend running?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>PM 1-Pager Generator</h1>
      </header>

      <main className="app-main">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <InputForm onSubmit={handleSubmit} isLoading={isLoading} />
      </main>
    </div>
  );
}
