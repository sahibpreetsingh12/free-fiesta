"use client";
import { useEffect, useRef } from "react";

export default function ModelCard({ title, content, loading, latency }) {
  const outputRef = useRef(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]); // runs on every token update

  return (
    <div className="card">
      <h2>{title}</h2>

      <div className="output" ref={outputRef}>
        {loading && content.length === 0 ? (
          <div className="loader"></div>
        ) : (
          <pre>{content}</pre>
        )}
      </div>

      {latency && (
        <p className="latency">Latency: {latency}s</p>
      )}
    </div>
  );
}
