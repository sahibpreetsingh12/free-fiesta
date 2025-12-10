from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from prometheus_client import Counter, Histogram, start_http_server
import requests
import json
import ray
import os
import time
from ray.util.queue import Queue
from contextlib import asynccontextmanager

# Define METRICS dictionary to hold Prometheus metrics
METRICS = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Ray, Prometheus metrics and server on startup
    ray.init(ignore_reinit_error=True)
    start_http_server(8001)
    
    METRICS["http_requests_total"] = Counter("http_requests_total", "Total number of HTTP requests", ["model"])
    METRICS["http_request_latency_seconds"] = Histogram("http_request_latency_seconds", "HTTP request latency in seconds", ["model"])
    METRICS["http_request_ttft_seconds"] = Histogram("http_request_ttft_seconds", "Time to first token in seconds", ["model"])
    METRICS["llm_tokens_generated_total"] = Counter("llm_tokens_generated_total", "Total number of LLM tokens generated", ["model"])
    METRICS["llm_tokens_per_second"] = Histogram("llm_tokens_per_second", "LLM tokens per second", ["model"])
    
    yield
    
    # Shutdown Ray on application exit
    ray.shutdown()

app = FastAPI(lifespan=lifespan)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

models = [
    "qwen2.5:0.5b",
    "qwen3:0.6b",
    "qwen2:0.5b",
]

@ray.remote
def stream_model(model, prompt, temperature, queue):
    """Stream tokens from Ollama and push into a Ray Queue."""
    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}],
        "options": {"temperature": temperature},
    }

    with requests.post(url, json=payload, stream=True) as r:
        for line in r.iter_lines():
            if not line:
                continue

            data = json.loads(line.decode())
            token = data.get("message", {}).get("content")

            if token:
                queue.put({"model": model, "token": token, "timestamp": time.time()})

    # Mark stream as completed for this model
    queue.put({"model": model, "token": None, "timestamp": time.time()})

@app.post("/stream_compare")
async def stream_compare(request: Request):
    data = await request.json()
    prompt = data["prompt"]
    temperature = data.get("temperature", 0.7)

    queues = [Queue() for _ in models]
    start_times = {}

    for model, q in zip(models, queues):
        METRICS["http_requests_total"].labels(model=model).inc()
        start_times[model] = time.time()
        stream_model.remote(model, prompt, temperature, q)

    def generate():
        finished = [False] * len(models)
        first_token_times = {}
        token_counts = {}

        while not all(finished):
            for i, q in enumerate(queues):
                if finished[i] or q.empty():
                    continue

                item = q.get()
                model = item["model"]

                if item["token"] is None:
                    finished[i] = True
                    end_time = item["timestamp"]
                    total_time = end_time - start_times[model]
                    METRICS["http_request_latency_seconds"].labels(model=model).observe(total_time)

                    if total_time > 0 and token_counts.get(model, 0) > 0:
                        tokens_per_sec = token_counts[model] / total_time
                        METRICS["llm_tokens_per_second"].labels(model=model).observe(tokens_per_sec)
                    continue

                if model not in first_token_times:
                    first_token_time = item["timestamp"]
                    first_token_times[model] = first_token_time
                    ttft = first_token_time - start_times[model]
                    METRICS["http_request_ttft_seconds"].labels(model=model).observe(ttft)

                token_counts[model] = token_counts.get(model, 0) + 1
                METRICS["llm_tokens_generated_total"].labels(model=model).inc()
                yield json.dumps(item) + "\n"

    return StreamingResponse(generate(), media_type="text/plain")

