import { useState, useRef } from "react";

export default function useModelStreams() {
  const [results, setResults] = useState({});
  const [metrics, setMetrics] = useState({}); // Stores latency for each model
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef(null);

  const startStreaming = async (prompt, temperature) => {
    setLoading(true);
    setResults({});
    setMetrics({});
    
    // 1. Mark the start time
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
              // Parse the backend JSON: { model: "qwen2...", token: "..." }
              const data = JSON.parse(line);
              
              if (data.model && data.token) {
                // Append token to text
                next[data.model] = (next[data.model] || "") + data.token;
                
                // Update Latency: (Current Time - Start Time) / 1000
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                currentMetrics[data.model] = elapsed;
              }
            } catch (e) {
              console.error("Parse error", e);
            }
          });

          // Update metrics state only if we have new data to avoid lag
          if (Object.keys(currentMetrics).length > 0) {
             setMetrics(prevM => ({ ...prevM, ...currentMetrics }));
          }
          
          return next;
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Stream Error:", err);
        setResults((prev) => ({ ...prev, Error: "Connection failed." }));
      }
    } finally {
      setLoading(false);
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  };

  return { results, metrics, loading, startStreaming, stopStreaming };
}