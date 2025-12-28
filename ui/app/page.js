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
  
  // Destructure 'metrics' from our updated hook
  const { results, metrics, loading, startStreaming } = useModelStreams();

  const handleClear = () => {
    setPrompt("");
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Free Fiesta – Streaming Comparison</h1>

      <div className={styles.inputSection}>
        {/* Preset Chips */}
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
          placeholder="Enter your prompt or choose a preset..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={styles.textarea}
        />

        <div className={styles.sliderWrapper}>
          <TemperatureSlider value={temperature} onChange={setTemperature} />
        </div>

        {/* Buttons */}
        <div className={styles.buttonGroup}>
          <button 
            className={styles.clearButton} 
            onClick={handleClear}
            disabled={loading}
          >
            Clear
          </button>
          <button
            className={`${styles.button} ${loading ? styles.buttonDisabled : ""}`}
            disabled={loading}
            onClick={() => startStreaming(prompt, temperature)}
          >
            {loading ? "Streaming..." : "Stream Compare Models"}
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className={styles.cardsGrid}>
        <ModelCard
          title="Qwen 2.5 (0.5B)"
          content={results["qwen2.5:0.5b"]}
          latency={metrics["qwen2.5:0.5b"]}  // Pass real metrics
          loading={loading}
        />

        <ModelCard
          title="Qwen 3 (0.6B)"
          content={results["qwen3:0.6b"]}
          latency={metrics["qwen3:0.6b"]}    // Pass real metrics
          loading={loading}
        />

        <ModelCard
          title="Qwen 2 (0.5B)"
          content={results["qwen2:0.5b"]}
          latency={metrics["qwen2:0.5b"]}    // Pass real metrics
          loading={loading}
        />
      </div>
    </div>
  );
}