"use client";

import { useState } from "react";
import ModelCard from "./components/ModelCard";
import TemperatureSlider from "./components/TemperatureSlider";
import useModelStreams from "./hooks/useModelStreams";
import styles from "./page.module.css";

const PRESETS = [
  { label: "🐍 Python Snake", text: "Write a complete Python script for a Snake game using pygame." },
  { label: "⚛️ Explain Quantum", text: "Explain quantum entanglement to a 5-year-old using emojis." },
  { label: "📊 SQL Query", text: "Write a complex SQL query to find the top 3 spending customers per region." },
  { label: "🐞 Find the Bug", text: "Here is some code: `def add(a,b): return a-b`. Find the bug and fix it." }
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const { results, loading, startStreaming } = useModelStreams();

  const fakeLatency = {
    "qwen2.5:0.5b": null,
    "qwen3:0.6b": null,
    "qwen2:0.5b": null,
  };

  return (
    <div className={styles.container}>
      {/* Title */}
      <h1 className={styles.title}>Free Fiesta – Streaming Comparison</h1>

      {/* Input Section */}
      <div className={styles.inputSection}>
        
        {/* NEW: Preset Prompt Chips */}
        <div className={styles.presetContainer}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={styles.presetChip}
              onClick={() => setPrompt(preset.text)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <textarea
          rows="5"
          placeholder="Enter your prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={styles.textarea}
        />

        <div className={styles.sliderWrapper}>
          <TemperatureSlider value={temperature} onChange={setTemperature} />
        </div>

        <button
          className={`${styles.button} ${loading ? styles.buttonDisabled : ""}`}
          disabled={loading}
          onClick={() => startStreaming(prompt, temperature)}
        >
          {loading ? "Streaming..." : "Stream Compare Models"}
        </button>
      </div>

      {/* Cards Grid - 3 Columns */}
      <div className={styles.cardsGrid}>
        <ModelCard
          title="Qwen 2.5 (0.5B)"
          content={results["qwen2.5:0.5b"]}
          loading={loading}
          latency={fakeLatency["qwen2.5:0.5b"]}
        />

        <ModelCard
          title="Qwen 3 (0.6B)"
          content={results["qwen3:0.6b"]}
          loading={loading}
          latency={fakeLatency["qwen3:0.6b"]}
        />

        <ModelCard
          title="Qwen 2 (0.5B)"
          content={results["qwen2:0.5b"]}
          loading={loading}
          latency={fakeLatency["qwen2:0.5b"]}
        />
      </div>
    </div>
  );
}