import ray
from ray import serve
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import requests
import os
import json
from typing import Dict

# ---------------------------------------------------------
# REMEMBER: No manual ray.init() or serve.start() here.
# Docker handles the connection now!
# ---------------------------------------------------------

# Config
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
VLLM_URL = os.getenv("VLLM_URL", "http://34.0.43.79:8001")

app = FastAPI()

# ---------------------------------------------------------
# DEPLOYMENT 1: The GPU Worker
# ---------------------------------------------------------
@serve.deployment(
    name="gpu_model",
    autoscaling_config={"min_replicas": 1, "max_replicas": 2},
    ray_actor_options={"num_cpus": 1} 
)
class GPUModel:
    def get_stream(self, prompt: str):
        payload = {
            "model": "Qwen/Qwen2.5-0.5B",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            "stream": True,
            "max_tokens": 512,
            "temperature": 0.1
        }
        try:
            with requests.post(
                f"{VLLM_URL}/v1/chat/completions",
                json=payload,
                stream=True,
                timeout=8
            ) as r:
                for line in r.iter_lines():
                    if line:
                        decoded = line.decode("utf-8")
                        if decoded.startswith("data: "):
                            yield decoded + "\n"
        except Exception as e:
            yield f"ERROR: {str(e)}\n"

# ---------------------------------------------------------
# DEPLOYMENT 2: The CPU Worker
# ---------------------------------------------------------
@serve.deployment(name="cpu_model")
class CPUModel:
    def get_stream(self, model_name: str, prompt: str):
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True
        }
        with requests.post(f"{OLLAMA_URL}/api/chat", json=payload, stream=True) as r:
            for line in r.iter_lines():
                if line:
                    yield line.decode("utf-8") + "\n"

# ---------------------------------------------------------
# DEPLOYMENT 3: The Orchestrator (The Manager)
# ---------------------------------------------------------
@serve.deployment(name="orchestrator")
@serve.ingress(app)
class Orchestrator:
    def __init__(self, gpu_handle, cpu_handle):
        self.gpu = gpu_handle
        self.cpu = cpu_handle

    @app.post("/stream_compare")
    async def stream_compare(self, data: Dict):
        prompt = data.get("prompt")
        
        # ✅ FIX: Added .options(stream=True)
        # This tells Ray that 'get_stream' will yield multiple results over time.
        gpu_generator = self.gpu.options(stream=True).get_stream.remote(prompt)
        
        return StreamingResponse(gpu_generator, media_type="text/event-stream")

# ---------------------------------------------------------
# WIRING IT TOGETHER
# ---------------------------------------------------------
gpu_deployment = GPUModel.bind()
cpu_deployment = CPUModel.bind()
ingress = Orchestrator.bind(gpu_deployment, cpu_deployment)