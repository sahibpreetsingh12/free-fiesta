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

  const handleCopy = async () => {
    if (!content) return;

    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      } else {
        // Fallback for older browsers or non-HTTPS
        fallbackCopy(content);
      }
    } catch (err) {
      console.error("Copy failed:", err);
      fallbackCopy(content);
    }
  };

  const fallbackCopy = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      console.error("Fallback copy failed:", err);
      alert("Could not copy text. Please try again.");
    }
    document.body.removeChild(textarea);
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