"use client";
import { useEffect, useRef, useState } from "react";

export default function ModelCard({ title, content, loading, latency }) {
  const outputRef = useRef(null);
  const [isCopied, setIsCopied] = useState(false);

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
    <div className="w-72 rounded-xl bg-neutral-800 shadow-lg flex flex-col p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-lg">{title}</h2>
        <button
          className="button px-3 py-1 rounded-md text-sm bg-purple-600 hover:bg-purple-700 transition whitespace-nowrap"
          onClick={handleCopy}
        >
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Scrollable Output */}
      <div
        ref={outputRef}
        className="flex-1 min-h-64 overflow-y-auto p-3 rounded-md bg-neutral-900 text-gray-200 text-sm"
      >
        {loading && (!content || content.length === 0) ? (
          <div className="text-gray-400">Loading...</div>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs">{content}</pre>
        )}
      </div>

      {/* Latency Display */}
      {latency && (
        <p className="latency mt-3 text-xs text-gray-400">
          Latency: {latency}s
        </p>
      )}
    </div>
  );
}