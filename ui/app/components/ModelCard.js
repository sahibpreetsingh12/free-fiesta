"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import styles from "./ModelCard.module.css";

export default function ModelCard({ title, content, loading, latency }) {
  const outputRef = useRef(null);
  const [isCopied, setIsCopied] = useState(false);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      } else {
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
        <button className={styles.copyButton} onClick={handleCopy}>
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Scrollable Output */}
      <div ref={outputRef} className={styles.output}>
        {loading && (!content || content.length === 0) ? (
          <div className={styles.loading}>Loading...</div>
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
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Latency Display */}
      {latency && <p className={styles.latency}>Latency: {latency}s</p>}
    </div>
  );
}