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
        
        # ✅ CHANGE 1: Do NOT catch the ConnectionError here.
        # We let it crash so the Orchestrator knows to switch to CPU.
        with requests.post(
            f"{VLLM_URL}/v1/chat/completions",
            json=payload,
            stream=True,
            timeout=5 # Short timeout so fallback happens fast
        ) as r:
            r.raise_for_status() # Raise error if vLLM returns 400/500
            
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
                            yield json.dumps({"model": "qwen2.5:0.5b (GPU)", "token": content}) + "\n"
                    except:
                        continue

# ---------------------------------------------------------
# DEPLOYMENT 2: The CPU Worker (Ollama)
# ---------------------------------------------------------
@serve.deployment(name="cpu_model")
class CPUModel:
    def get_stream(self, model_name: str, prompt: str):
        # Allow the UI to distinguish if it's running on CPU fallback
        display_name = model_name
        if "GPU" not in display_name and model_name == "qwen2.5:0.5b":
             display_name = f"{model_name} (CPU Fallback)"

        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "options": {"temperature": 0.3}
        }
        
        try:
            with requests.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload,
                stream=True,
                timeout=300
            ) as r:
                if r.status_code != 200:
                    yield json.dumps({"model": display_name, "token": f" [Error: Ollama {r.status_code}]"}) + "\n"
                    return

                for line in r.iter_lines():
                    if not line: continue
                    try:
                        data = json.loads(line.decode())
                        if data.get("done"): break
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield json.dumps({"model": display_name, "token": content}) + "\n"
                    except:
                        continue
                        
        except Exception as e:
            yield json.dumps({"model": display_name, "token": f" [Error: {str(e)}]"}) + "\n"

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

        # -------------------------------------------------
        # ✅ CHANGE 2: Smart Generator with Fallback
        # -------------------------------------------------
        async def smart_gpu_stream():
            try:
                # 1. Try getting the GPU stream generator
                gpu_gen = self.gpu.options(stream=True).get_stream.remote(prompt)
                
                # 2. Iterate through it. If vLLM is down, this crashes immediately.
                async for item in gpu_gen:
                    yield item
                    
            except Exception as e:
                # 3. CATCH THE CRASH! -> Switch to Ollama
                print(f"GPU Failed ({str(e)}). Switching to CPU Fallback.")
                
                # Yield a small debug message (optional)
                # yield json.dumps({"model": "qwen2.5:0.5b", "token": " [⚠️ GPU Offline. Switching to CPU...] "}) + "\n"
                
                # 4. Call CPU Model with the SAME model name
                fallback_gen = self.cpu.options(stream=True).get_stream.remote("qwen2.5:0.5b", prompt)
                async for item in fallback_gen:
                    yield item

        # -------------------------------------------------
        # Standard CPU Comparison Stream (Qwen 2)
        # -------------------------------------------------
        cpu_gen = self.cpu.options(stream=True).get_stream.remote("qwen2:0.5b", prompt)

        # -------------------------------------------------
        # Merge Logic
        # -------------------------------------------------
        async def merge_streams():
            # Run the "Smart" GPU stream (which might actually be CPU if fallback happens)
            async for item in smart_gpu_stream():
                yield item
            
            # Run the Standard comparison stream
            async for item in cpu_gen:
                yield item

        return StreamingResponse(merge_streams(), media_type="text/event-stream")

# ---------------------------------------------------------
# WIRING
# ---------------------------------------------------------
gpu_deployment = GPUModel.bind()
cpu_deployment = CPUModel.bind()
ingress = Orchestrator.bind(gpu_deployment, cpu_deployment)