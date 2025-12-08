"use client";

import { useState } from "react";
import ModelCard from "./components/ModelCard";
import TemperatureSlider from "./components/TemperatureSlider";
import useModelStreams from "./hooks/useModelStreams";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const { results, loading, startStreaming } = useModelStreams();

  const fakeLatency = {
    "qwen2.5:0.5b": null,
    "qwen3:0.6b": null,
    "qwen2:0.5b": null,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-center text-3xl font-bold mb-6">
        Free Fiesta – Streaming Comparison
      </h1>

      <textarea
        rows="5"
        placeholder="Enter your prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full max-w-3xl mx-auto block p-4 rounded-lg bg-neutral-900 text-gray-200 mb-4"
      />

      <div className="w-full max-w-3xl mx-auto mb-4">
        <TemperatureSlider value={temperature} onChange={setTemperature} />
      </div>

      <div className="w-full max-w-3xl mx-auto mb-6">
        <button
          className="button w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700"
          disabled={loading}
          onClick={() => startStreaming(prompt, temperature)}
        >
          {loading ? "Streaming..." : "Stream Compare Models"}
        </button>
      </div>

      {/* 3 Horizontal Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
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
