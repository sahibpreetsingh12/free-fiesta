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
VLLM_URL = os.getenv("VLLM_URL", "http://34.0.43.79:8001")

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
    """
    Hybrid inference:
    - qwen2.5:0.5b → vLLM (/v1/completions)
    - others → Ollama
    """

    # =======================
    # 1️⃣ vLLM MODEL
    # =======================
    if model == "qwen2.5:0.5b":
        payload = {
            "model": "Qwen/Qwen2.5-0.5B",
            "prompt": prompt,          # ✅ CORRECT for /v1/completions
            "stream": True,
            "temperature": temperature,
            "max_tokens": 500,
        }

        with requests.post(
            f"{VLLM_URL}/v1/completions",
            json=payload,
            stream=True,
            timeout=300,
        ) as r:

            for line in r.iter_lines():
                if not line:
                    continue

                # vLLM streams as SSE: data: {...}
                if not line.startswith(b"data: "):
                    continue

                data = line[6:].decode()

                if data == "[DONE]":
                    break

                try:
                    text = json.loads(data)["choices"][0].get("text", "")
                except Exception:
                    text = ""

                if text:
                    queue.put({"model": model, "token": text})

        queue.put({"model": model, "token": None})
        return

    # =======================
    # 2️⃣ OLLAMA MODELS
    # =======================
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}],
        "options": {"temperature": temperature},
    }

    with requests.post(
        f"{OLLAMA_URL}/api/chat",
        json=payload,
        stream=True,
        timeout=300,
    ) as r:

        for line in r.iter_lines():
            if not line:
                continue

            data = json.loads(line.decode())
            token = data.get("message", {}).get("content")

            if token:
                queue.put({"model": model, "token": token})

    queue.put({"model": model, "token": None})


# -----------------------
# FASTAPI STREAM ENDPOINT
# -----------------------
@app.post("/stream_compare")
def stream_compare(data: dict):
    prompt = data["prompt"]
    temperature = data.get("temperature", 0.7)

    queues = [Queue() for _ in models]

    # Start Ray workers
    for model, q in zip(models, queues):
        stream_model.remote(model, prompt, temperature, q)

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
