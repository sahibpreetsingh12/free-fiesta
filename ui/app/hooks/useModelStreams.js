"use client";

import { useState } from "react";

export default function useModelStreams() {
  const [results, setResults] = useState({
    "qwen2.5:0.5b": "",
    "qwen3:0.6b": "",
    "qwen2:0.5b": ""
  });

  const [loading, setLoading] = useState(false);

  const startStreaming = async (prompt) => {
    setLoading(true);

    // Reset results
    setResults({
      "qwen2.5:0.5b": "",
      "qwen3:0.6b": "",
      "qwen2:0.5b": ""
    });

    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    const response = await fetch(`${API_URL}/stream_compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true }).trim();

      // Data can contain multiple JSON lines
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          const model = data.model;
          const token = data.token;

          setResults((prev) => ({
            ...prev,
            [model]: prev[model] + token
          }));
        } catch (e) {
          console.warn("Bad JSON chunk:", line);
        }
      }
    }

    setLoading(false);
  };

  return { results, loading, startStreaming };
}
