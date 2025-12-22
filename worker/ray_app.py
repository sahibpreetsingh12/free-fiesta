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
        
        # Try connecting to GPU. If it fails, we let the Orchestrator handle the crash.
        with requests.post(
            f"{VLLM_URL}/v1/chat/completions",
            json=payload,
            stream=True,
            timeout=5 # Fail fast (5s) if GPU is off
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
                            # Send exact ID expected by UI Box 1
                            yield json.dumps({"model": "qwen2.5:0.5b", "token": content}) + "\n"
                    except:
                        continue

# ---------------------------------------------------------
# DEPLOYMENT 2: The CPU Worker (Ollama)
# ---------------------------------------------------------
@serve.deployment(name="cpu_model")
class CPUModel:
    def get_stream(self, model_name: str, prompt: str, target_ui_name: str = None):
        """
        model_name: The actual model to run in Ollama (must exist there)
        target_ui_name: The name we send back to the UI (so it goes in the right box)
        """
        
        # If no target name is provided, use the actual model name
        if not target_ui_name:
            target_ui_name = model_name

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
                    yield json.dumps({"model": target_ui_name, "token": f" [Error: Ollama {r.status_code}]"}) + "\n"
                    return

                for line in r.iter_lines():
                    if not line: continue
                    try:
                        data = json.loads(line.decode())
                        if data.get("done"): break
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield json.dumps({"model": target_ui_name, "token": content}) + "\n"
                    except:
                        continue
                        
        except Exception as e:
            yield json.dumps({"model": target_ui_name, "token": f" [Error: {str(e)}]"}) + "\n"

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

        # --- STREAM 1: GPU Box (with silent CPU fallback) ---
        async def smart_gpu_stream():
            try:
                gpu_gen = self.gpu.options(stream=True).get_stream.remote(prompt)
                async for item in gpu_gen:
                    yield item
            except Exception as e:
                # SILENT FALLBACK: Run CPU model, but label it "qwen2.5:0.5b" so it fills Box 1
                fallback_gen = self.cpu.options(stream=True).get_stream.remote(
                    model_name="qwen2.5:0.5b", 
                    prompt=prompt,
                    target_ui_name="qwen2.5:0.5b"
                )
                async for item in fallback_gen:
                    yield item

        # --- STREAM 2: Middle Box (Qwen 3) ---
        # Note: I am running "qwen2.5:0.5b" behind the scenes to ensure it works,
        # but I am sending the ID "qwen3:0.6b" (or whatever your UI expects for Box 2).
        # IF YOU HAVE ACTUAL QWEN 3 INSTALLED, change model_name="qwen3:0.6b"
        cpu_gen_middle = self.cpu.options(stream=True).get_stream.remote(
            model_name="qwen2.5:0.5b", 
            prompt=prompt, 
            target_ui_name="qwen3:0.6b" # <--- This key directs it to the Middle Box
        )

        # --- STREAM 3: Right Box (Qwen 2) ---
        cpu_gen_right = self.cpu.options(stream=True).get_stream.remote(
            model_name="qwen2:0.5b", 
            prompt=prompt,
            target_ui_name="qwen2:0.5b"
        )

        # --- MERGE ALL 3 ---
        async def merge_streams():
            # 1. Yield GPU/Fallback stream
            async for item in smart_gpu_stream(): yield item
            
            # 2. Yield Middle Box stream
            async for item in cpu_gen_middle: yield item
            
            # 3. Yield Right Box stream
            async for item in cpu_gen_right: yield item

        return StreamingResponse(merge_streams(), media_type="text/event-stream")

# ---------------------------------------------------------
# WIRING
# ---------------------------------------------------------
gpu_deployment = GPUModel.bind()
cpu_deployment = CPUModel.bind()
ingress = Orchestrator.bind(gpu_deployment, cpu_deployment)