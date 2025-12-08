"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./ModelCard.module.css";

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
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button
          className={styles.copyButton}
          onClick={handleCopy}
        >
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Scrollable Output */}
      <div
        ref={outputRef}
        className={styles.output}
      >
        {loading && (!content || content.length === 0) ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <pre className={styles.content}>{content}</pre>
        )}
      </div>

      {/* Latency Display */}
      {latency && (
        <p className={styles.latency}>Latency: {latency}s</p>
      )}
    </div>
  );
}