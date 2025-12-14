from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import requests
import json
import ray
import os
from ray.util.queue import Queue   

app = FastAPI()
ray.init(ignore_reinit_error=True)

# -----------------------
# CONFIG
# -----------------------
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
VLLM_URL = os.getenv("VLLM_URL", "http://34.10.217.235:8001")

# Models mapped exactly to UI
models = [
    "qwen2.5:0.5b",   # → vLLM
    "qwen3:0.6b",     # → Ollama
    "qwen2:0.5b",     # → Ollama
]

# -----------------------
# RAY REMOTE WORKER
# -----------------------
@ray.remote
def stream_model(model, prompt, temperature, queue):
    """Hybrid inference: first model via vLLM, remaining via Ollama."""

    # 1️⃣ MODEL 1 → vLLM (GPU)
    if model == "qwen2.5:0.5b":
        payload = {
            "model": "Qwen/Qwen2.5-0.5B",
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "temperature": temperature,
            "max_tokens": 500,
        }

        with requests.post(f"{VLLM_URL}/v1/completions", json=payload, stream=True) as r:
            for line in r.iter_lines():
                if not line or not line.startswith(b"data: "):
                    continue

                data = line[6:].decode()
                if data == "[DONE]":
                    break

                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content", "")
                except:
                    delta = ""

                if delta:
                    queue.put({"model": model, "token": delta})

        queue.put({"model": model, "token": None})
        return

    # -----------------------------------------------------------
    # 2️⃣ OTHER MODELS → OLLAMA (as before)
    # -----------------------------------------------------------
    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}],
        "options": {"temperature": temperature}
    }

    with requests.post(url, json=payload, stream=True) as r:
        for line in r.iter_lines():
            if not line:
                continue

            data = json.loads(line.decode())
            token = data.get("message", {}).get("content")

            if token:
                queue.put({"model": model, "token": token})

    queue.put({"model": model, "token": None})


@app.post("/stream_compare")
def stream_compare(data: dict):
    prompt = data["prompt"]
    temperature = data.get("temperature", 0.7) # Default temperature if not provided

    # One queue per model
    queues = [Queue() for _ in models]

    # Start streaming workers
    tasks = [
        stream_model.remote(model, prompt, temperature, q)
        for model, q in zip(models, queues)
    ]

    finished = [False] * len(models)

    def generate():
        while not all(finished):
            for i, q in enumerate(queues):
                if finished[i]:
                    continue

                if not q.empty():
                    item = q.get()

                    if item["token"] is None:
                        finished[i] = True
                        continue

                    yield json.dumps(item) + "\n"

    return StreamingResponse(generate(), media_type="text/plain")
