import ray
from ray import serve
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import requests
import os
import json
from typing import Dict

# Config
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
VLLM_URL = os.getenv("VLLM_URL", "http://34.0.43.79:8001")

app = FastAPI()

# ---------------------------------------------------------
# DEPLOYMENT 1: The GPU Worker (Fixed Format)
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
                    if not line:
                        continue
                    
                    decoded = line.decode("utf-8")
                    
                    # 1. Skip the "DONE" signal
                    if "[DONE]" in decoded:
                        break
                        
                    # 2. Parse the vLLM "data: {...}" format
                    if decoded.startswith("data: "):
                        json_str = decoded[6:] # Strip "data: "
                        try:
                            data = json.loads(json_str)
                            # 3. Extract the actual text token
                            content = data["choices"][0]["delta"].get("content", "")
                            
                            if content:
                                # 4. Yield in the format the Frontend expects
                                output = {
                                    "model": "qwen2.5:0.5b", 
                                    "token": content
                                }
                                yield json.dumps(output) + "\n"
                        except:
                            continue
                            
        except Exception as e:
            err_output = {"model": "qwen2.5:0.5b", "token": f" [Error: {str(e)}]"}
            yield json.dumps(err_output) + "\n"

# ---------------------------------------------------------
# DEPLOYMENT 2: The CPU Worker (Placeholder)
# ---------------------------------------------------------
@serve.deployment(name="cpu_model")
class CPUModel:
    def get_stream(self, model_name: str, prompt: str):
        # We will fix this one later if needed, focusing on GPU first
        yield json.dumps({"model": model_name, "token": ""}) + "\n"

# ---------------------------------------------------------
# DEPLOYMENT 3: The Orchestrator
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
        # Ensure we use .options(stream=True)
        gpu_generator = self.gpu.options(stream=True).get_stream.remote(prompt)
        return StreamingResponse(gpu_generator, media_type="text/event-stream")

# ---------------------------------------------------------
# WIRING
# ---------------------------------------------------------
gpu_deployment = GPUModel.bind()
cpu_deployment = CPUModel.bind()
ingress = Orchestrator.bind(gpu_deployment, cpu_deployment)