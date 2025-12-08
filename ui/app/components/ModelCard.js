"use client";
import { useEffect, useRef, useState } from "react";

export default function ModelCard({ title, content, loading, latency }) {
  const outputRef = useRef(null);
  const [isCopied, setIsCopied] = useState(false);

  // Auto-scroll when content updates
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    });
  };

  return (
    <div className="card w-full max-w-md mx-auto p-4 rounded-xl bg-neutral-800 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold text-lg">{title}</h2>
        <button
          className="button px-3 py-1 rounded-md text-sm bg-purple-600 hover:bg-purple-700"
          onClick={handleCopy}
          disabled={!content}
        >
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div
        ref={outputRef}
        className="output max-h-64 overflow-auto p-3 rounded-md bg-neutral-900 text-gray-200"
      >
        {loading && content.length === 0 ? (
          <div className="loader">Loading...</div>
        ) : (
          <pre className="whitespace-pre-wrap">{content}</pre>
        )}
      </div>

      {latency && (
        <p className="latency mt-2 text-sm text-gray-400">Latency: {latency}s</p>
      )}
    </div>
  );
}
