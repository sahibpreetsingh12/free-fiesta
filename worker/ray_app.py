import ray
from ray import serve
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import requests
import os
import json
import asyncio  # <--- NEW IMPORT REQUIRED
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
                            yield json.dumps({"model": "qwen2.5:0.5b", "token": content}) + "\n"
                    except:
                        continue

# ---------------------------------------------------------
# DEPLOYMENT 2: The CPU Worker (Ollama)
# ---------------------------------------------------------
@serve.deployment(name="cpu_model")
class CPUModel:
    def get_stream(self, model_name: str, prompt: str, target_ui_name: str = None):
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
                # We assume self.gpu.get_stream returns a Ray ObjectRefGenerator
                gpu_gen = self.gpu.options(stream=True).get_stream.remote(prompt)
                async for item in gpu_gen:
                    yield item
            except Exception as e:
                # SILENT FALLBACK
                fallback_gen = self.cpu.options(stream=True).get_stream.remote(
                    model_name="qwen2.5:0.5b", 
                    prompt=prompt,
                    target_ui_name="qwen2.5:0.5b"
                )
                async for item in fallback_gen:
                    yield item

        # --- STREAM 2: Middle Box ---
        cpu_gen_middle = self.cpu.options(stream=True).get_stream.remote(
            model_name="qwen2.5:0.5b", 
            prompt=prompt, 
            target_ui_name="qwen3:0.6b"
        )

        # --- STREAM 3: Right Box ---
        cpu_gen_right = self.cpu.options(stream=True).get_stream.remote(
            model_name="qwen2:0.5b", 
            prompt=prompt,
            target_ui_name="qwen2:0.5b"
        )

        # --- MERGE STREAMS (THE FIX) ---
        async def merge_streams():
            queue = asyncio.Queue()

            # Helper to push stream items into the shared queue
            async def producer(iterator):
                try:
                    async for item in iterator:
                        await queue.put(item)
                except Exception as e:
                    await queue.put(json.dumps({"error": str(e)}) + "\n")
                finally:
                    # Signal that this specific producer is done
                    await queue.put(None)

            # Start all 3 producers concurrently as background tasks
            tasks = [
                asyncio.create_task(producer(smart_gpu_stream())),
                asyncio.create_task(producer(cpu_gen_middle)),
                asyncio.create_task(producer(cpu_gen_right))
            ]

            # Consumer loop: Keep yielding until all 3 producers send their "None" sentinel
            finished_producers = 0
            total_producers = 3

            while finished_producers < total_producers:
                # Wait for the next token from ANY model
                item = await queue.get()
                
                if item is None:
                    finished_producers += 1
                else:
                    yield item

        return StreamingResponse(merge_streams(), media_type="text/event-stream")

# ---------------------------------------------------------
# WIRING
# ---------------------------------------------------------
gpu_deployment = GPUModel.bind()
cpu_deployment = CPUModel.bind()
ingress = Orchestrator.bind(gpu_deployment, cpu_deployment)