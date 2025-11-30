"use client";

import { useState } from "react";
import ModelCard from "./components/ModelCard";
import TemperatureSlider from "./components/TemperatureSlider";
import useModelStreams from "./hooks/useModelStreams";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7); // Initialize temperature state
  const { results, loading, startStreaming } = useModelStreams();

  const [fakeLatency] = useState({
    "qwen2.5:0.5b": null,
    "qwen3:0.6b": null,
    "qwen2:0.5b": null
  });

  return (
    <div className="container">
      <h1>Free Fiesta – Streaming Comparison</h1>

      <textarea
        rows="5"
        placeholder="Enter your prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      
      {/* Temperature Slider */}
      <TemperatureSlider value={temperature} onChange={setTemperature} />

      {/* Streaming Button */}
      <button
        className="button"
        disabled={loading}
        onClick={() => startStreaming(prompt)}
      >
        {loading ? "Streaming..." : "Stream Compare Models"}
      </button>

      <div className="grid">
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
