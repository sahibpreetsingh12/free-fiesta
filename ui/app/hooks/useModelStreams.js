import { useState, useRef } from "react";

export default function useModelStreams() {
  const [results, setResults] = useState({});
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);
  const firstTokenTimeRef = useRef({}); // Tracks TTFT

  const startStreaming = async (prompt, temperature) => {
    setLoading(true);
    setResults({});
    setMetrics({});
    firstTokenTimeRef.current = {};

    const startTime = Date.now();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream_compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, temperature }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalAccumulatedText = {};

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        setResults((prev) => {
          const next = { ...prev };
          const currentMetrics = {};

          lines.forEach((line) => {
            if (!line.trim()) return;
            try {
              const data = JSON.parse(line);
              if (data.model && data.token) {
                // 1. Capture TTFT
                if (!firstTokenTimeRef.current[data.model]) {
                  firstTokenTimeRef.current[data.model] = (Date.now() - startTime) / 1000;
                }
                // 2. Append Text
                next[data.model] = (next[data.model] || "") + data.token;
                finalAccumulatedText[data.model] = next[data.model];
                // 3. Update Latency
                currentMetrics[data.model] = ((Date.now() - startTime) / 1000).toFixed(2);
              }
            } catch (e) { /* ignore */ }
          });

          if (Object.keys(currentMetrics).length > 0) {
            setMetrics((prevM) => ({ ...prevM, ...currentMetrics }));
          }
          return next;
        });
      }

      // SAVE DATA TO HISTORY
      saveRunToHistory(finalAccumulatedText, firstTokenTimeRef.current, metrics, startTime);

    } catch (err) {
      if (err.name !== "AbortError") console.error("Stream Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setLoading(false);
  };

  return { results, metrics, loading, startStreaming, stopStreaming };
}

// HELPER: Saves to LocalStorage
function saveRunToHistory(texts, ttfts, latencies, startTime) {
  const timestamp = new Date().toISOString();
  const runId = startTime;
  
  const stats = Object.keys(texts).map(model => {
    const content = texts[model];
    const latency = parseFloat(latencies[model] || 0);
    const ttft = ttfts[model] || 0;
    const tokenCount = Math.ceil(content.length / 4); // Approx tokens
    const tps = latency > 0 ? (tokenCount / latency).toFixed(2) : 0;

    return {
      model,
      latency,
      ttft: typeof ttft === 'number' ? ttft.toFixed(3) : 0,
      tokenCount,
      tps,
      timestamp
    };
  });

  const existing = JSON.parse(localStorage.getItem("inferenceHistory") || "[]");
  const updated = [...existing, { id: runId, date: timestamp, stats }];
  localStorage.setItem("inferenceHistory", JSON.stringify(updated));
}