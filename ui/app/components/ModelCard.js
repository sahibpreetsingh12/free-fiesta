"use client";
import { useEffect, useRef, useState } from "react";

export default function ModelCard({ title, content, loading, latency }) {
  const outputRef = useRef(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]); // runs on every token update

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    });
  };

  return (
    <div className="card max-w-3xl w-full mx-auto">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{title}</h2>
        <button className="button" onClick={handleCopy} disabled={!content}>
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>

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
