from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import requests
import json
import ray
import os
from ray.util.queue import Queue   

app = FastAPI()
ray.init(ignore_reinit_error=True)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

models = [
    "qwen2.5:0.5b",
    "qwen3:0.6b",
    "qwen2:0.5b",
]


@ray.remote
def stream_model(model, prompt, queue):
    """Stream tokens from Ollama and push into a Ray Queue."""
    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "user", "content": prompt}]
    }

    with requests.post(url, json=payload, stream=True) as r:
        for line in r.iter_lines():
            if not line:
                continue

            data = json.loads(line.decode())
            token = data.get("message", {}).get("content")

            if token:
                queue.put({
                    "model": model,
                    "token": token
                })

    # Mark stream as completed for this model
    queue.put({
        "model": model,
        "token": None
    })


@app.post("/stream_compare")
def stream_compare(data: dict):
    prompt = data["prompt"]

    # One queue per model
    queues = [Queue() for _ in models]    # ✅ FIXED

    # Start streaming workers
    tasks = [
        stream_model.remote(model, prompt, q)
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
