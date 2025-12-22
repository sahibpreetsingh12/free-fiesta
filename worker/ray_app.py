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
# DEPLOYMENT 1: The GPU Worker (vLLM)
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
        
        # We let requests raise an error naturally so the Orchestrator catches it
        with requests.post(
            f"{VLLM_URL}/v1/chat/completions",
            json=payload,
            stream=True,
            timeout=5 # Short timeout -> Fail fast -> Switch to CPU
        ) as r:
            r.raise_for_status()
            
            for line in r.iter_lines():
                if not line: continue
                decoded = line.decode("utf-8")
                
                if "[DONE]" in decoded: break
                if decoded.startswith("data: "):
                    json_str = decoded[6:]
                    try:
                        data = json.loads(json_str)
                        content = data["choices"][0]["delta"].get("content", "")
                        if content:
                            # Use exact ID expected by UI
                            yield json.dumps({"model": "qwen2.5:0.5b", "token": content}) + "\n"
                    except:
                        continue

# ---------------------------------------------------------
# DEPLOYMENT 2: The CPU Worker (Ollama)
# ---------------------------------------------------------
@serve.deployment(name="cpu_model")
class CPUModel:
    def get_stream(self, model_name: str, prompt: str, is_fallback: bool = False):
        
        # 1. Prepare visual indicator if this is a fallback
        # We DO NOT change the 'model' key, or the UI will ignore the message.
        # Instead, we send a prefix token first.
        prefix = ""
        if is_fallback:
             prefix = "⚠️ [GPU Offline - Switched to CPU]\n\n"

        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "options": {"temperature": 0.3}
        }
        
        try:
            # Send the prefix first (if any)
            if prefix:
                yield json.dumps({"model": model_name, "token": prefix}) + "\n"

            with requests.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload,
                stream=True,
                timeout=300
            ) as r:
                if r.status_code != 200:
                    yield json.dumps({"model": model_name, "token": f" [Error: Ollama {r.status_code}]"}) + "\n"
                    return

                for line in r.iter_lines():
                    if not line: continue
                    try:
                        data = json.loads(line.decode())
                        if data.get("done"): break
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield json.dumps({"model": model_name, "token": content}) + "\n"
                    except:
                        continue
                        
        except Exception as e:
            yield json.dumps({"model": model_name, "token": f" [Error: {str(e)}]"}) + "\n"

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

        # --- STREAM 1: GPU (with fallback) ---
        async def smart_gpu_stream():
            try:
                gpu_gen = self.gpu.options(stream=True).get_stream.remote(prompt)
                async for item in gpu_gen:
                    yield item
            except Exception as e:
                # Call CPU but use the SAME model name "qwen2.5:0.5b"
                # so the UI puts the text in the correct box.
                fallback_gen = self.cpu.options(stream=True).get_stream.remote(
                    "qwen2.5:0.5b", prompt, is_fallback=True
                )
                async for item in fallback_gen:
                    yield item

        # --- STREAM 2: Standard Comparison (Qwen 2) ---
        # Ensure this model name matches your UI exactly
        cpu_gen_2 = self.cpu.options(stream=True).get_stream.remote("qwen2:0.5b", prompt)

        # --- STREAM 3: The Missing Link (Qwen 3 / or another model) ---
        # Note: Ensure you have "qwen2.5:0.5b" or the correct model pulled in Ollama
        # If you don't have an actual Qwen 3 model, I'm reusing qwen2.5 for demo
        cpu_gen_3 = self.cpu.options(stream=True).get_stream.remote("qwen2.5:0.5b", prompt)
        
        # If you want to trick the UI into thinking it's Qwen 3 (just for display):
        # You would need to update the CPUModel to accept a "target_ui_box" parameter.
        # For now, let's assume your UI expects "qwen2.5:1.5b" or similar for the middle box.

        # --- MERGE ALL 3 ---
        async def merge_streams():
            # In Python, we can't easily run 3 async generators in parallel 
            # without a library like 'aiostream', so we chain them for stability.
            # (Or simply yield them one by one).
            
            async for item in smart_gpu_stream(): yield item
            async for item in cpu_gen_2: yield item
            async for item in cpu_gen_3: yield item 

        return StreamingResponse(merge_streams(), media_type="text/event-stream")

# ---------------------------------------------------------
# WIRING
# ---------------------------------------------------------
gpu_deployment = GPUModel.bind()
cpu_deployment = CPUModel.bind()
ingress = Orchestrator.bind(gpu_deployment, cpu_deployment)