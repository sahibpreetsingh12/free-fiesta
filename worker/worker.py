from fastapi import FastAPI
import requests
import ray
import os

app = FastAPI()
ray.init(ignore_reinit_error=True)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

models = [
    "qwen2.5:0.5b",
    "qwen3:0.6b",
    "qwen2:0.5b"
]


@ray.remote
def call_model(model, prompt):
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "num_predict": 100,
    }

    res = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)

    try:
        data = res.json()
    except Exception:
        return {model: "Error: Invalid model output."}

    # FIX: Extract text from ANY possible Ollama key:
    output = (
        data.get("response")
        or data.get("message")
        or data.get("content")
        or data.get("text")
        or data.get("output")
        or ""
    )

    return {model: output}

@app.post("/compare")
def compare(data: dict):
    prompt = data["prompt"]

    tasks = [call_model.remote(model, prompt) for model in models]
    results = ray.get(tasks)

    final = {}
    for r in results:
        final.update(r)
    return final