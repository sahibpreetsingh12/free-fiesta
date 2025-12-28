"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import styles from "./ModelCard.module.css";

export default function ModelCard({ title, content, loading, latency, isWinner }) {
  const outputRef = useRef(null);
  const [isCopied, setIsCopied] = useState(false);

  // Auto-scroll logic
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      alert("Copy failed");
    }
  };

  const isActive = loading && (!latency || parseFloat(latency) > 0);

  return (
    <div className={`
      ${styles.card} 
      ${isActive ? styles.cardStreaming : ''} 
      ${isWinner ? styles.cardWinner : ''}
    `}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <h2 className={styles.title}>{title}</h2>
          {isWinner && <span className={styles.trophy}>🏆 Fastest</span>}
        </div>
        
        <button className={styles.copyButton} onClick={handleCopy}>
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Scrollable Output */}
      <div ref={outputRef} className={styles.output}>
        {loading && (!content || content.length === 0) ? (
          <div className={styles.loading}>Initializing stream...</div>
        ) : (
          <div className={styles.markdownWrapper}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={styles.inlineCode} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content || ""}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Speed Metrics Footer */}
      <div className={styles.footer}>
        {latency ? (
            <span className={styles.metricSuccess}>⏱️ {latency}s total</span>
        ) : (
            <span className={styles.metricIdle}>Waiting...</span>
        )}
      </div>
    </div>
  );
}