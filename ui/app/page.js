"use client";

import { useState } from "react";
import ModelCard from "./components/ModelCard";
import TemperatureSlider from "./components/TemperatureSlider";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);

  const [results, setResults] = useState({
    "qwen2.5:0.5b": "",
    "qwen3:0.6b": "",
    "qwen2:0.5b": ""
  });

  const [latency, setLatency] = useState({
    "qwen2.5:0.5b": null,
    "qwen3:0.6b": null,
    "qwen2:0.5b": null
  });

  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);

    const start = performance.now();
    const res = await fetch("http://localhost:8000/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, temperature })
    });
    const data = await res.json();
    const end = performance.now();

    setResults(data);

    // Compute latency per model (Ray parallel => same time)
    const elapsed = Math.round(end - start);

    setLatency({
      "qwen2.5:0.5b": elapsed,
      "qwen3:0.6b": elapsed,
      "qwen2:0.5b": elapsed
    });

    setLoading(false);
  };

  return (
    <div className="container">
      <h1>Free Fiesta – Qwen Model Comparison</h1>

      <textarea
        rows="5"
        placeholder="Enter your prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {/* Temperature */}
      <TemperatureSlider value={temperature} onChange={setTemperature} />

      {/* Button */}
      <button className="button" onClick={send} disabled={loading}>
        {loading ? "Thinking..." : "Compare Models"}
      </button>

      {/* Result 3 Column Grid */}
      <div className="grid">
        <ModelCard
          title="Qwen 2.5 (0.5B)"
          content={results["qwen2.5:0.5b"]}
          loading={loading}
          latency={latency["qwen2.5:0.5b"]}
        />

        <ModelCard
          title="Qwen 3 (0.6B)"
          content={results["qwen3:0.6b"]}
          loading={loading}
          latency={latency["qwen3:0.6b"]}
        />

        <ModelCard
          title="Qwen 2 (0.5B)"
          content={results["qwen2:0.5b"]}
          loading={loading}
          latency={latency["qwen2:0.5b"]}
        />
      </div>
    </div>
  );
}

