import ray
from ray import serve
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import httpx  # <--- SWAP requests FOR httpx
import os
import json
import asyncio
from typing import Dict

# Config
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
# Ensure this matches your actual GPU server IP
VLLM_URL = os.getenv("VLLM_URL", "http://34.0.43.79:8001") 

app = FastAPI()

# ---------------------------------------------------------
# DEPLOYMENT 1: The GPU Worker (vLLM) -> Now Async!
# ---------------------------------------------------------
@serve.deployment(
    name="gpu_model",
    autoscaling_config={"min_replicas": 1, "max_replicas": 2},
    ray_actor_options={"num_cpus": 1} 
)
class GPUModel:
    # 1. Changed to 'async def' so it doesn't block the event loop
    async def get_stream(self, prompt: str):
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
        
        # 2. Use AsyncClient to prevent blocking
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                async with client.stream("POST", f"{VLLM_URL}/v1/chat/completions", json=payload) as response:
                    response.raise_for_status()
                    
                    async for line in response.aiter_lines():
                        if not line: continue
                        if "[DONE]" in line: break
                        if line.startswith("data: "):
                            json_str = line[6:]
                            try:
                                data = json.loads(json_str)
                                content = data["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield json.dumps({"model": "qwen2.5:0.5b", "token": content}) + "\n"
                            except:
                                continue
        except Exception as e:
            # We raise the error so the Orchestrator knows to trigger the fallback
            raise e

# ---------------------------------------------------------
# DEPLOYMENT 2: The CPU Worker (Ollama) -> Now Async!
# ---------------------------------------------------------
@serve.deployment(name="cpu_model")
class CPUModel:
    async def get_stream(self, model_name: str, prompt: str, target_ui_name: str = None):
        if not target_ui_name:
            target_ui_name = model_name

        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
            "options": {"temperature": 0.3}
        }
        
        try:
            # Increased timeout for CPU models as they are slower
            async with httpx.AsyncClient(timeout=300.0) as client:
                async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as response:
                    
                    if response.status_code != 200:
                        yield json.dumps({"model": target_ui_name, "token": f" [Error: Ollama {response.status_code}]"}) + "\n"
                        return

                    async for line in response.aiter_lines():
                        if not line: continue
                        try:
                            data = json.loads(line)
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
# ---------------------------------------------------------
# DEPLOYMENT 3: The Orchestrator (FIXED)
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
                # FIX 1: Removed 'await'. Get the generator directly.
                gpu_gen = self.gpu.options(stream=True).get_stream.remote(prompt)
                
                # The exception (if GPU is down) will be raised here during iteration
                async for item in gpu_gen:
                    yield item
            except Exception as e:
                # SILENT FALLBACK
                print(f"GPU failed ({e}), switching to CPU fallback.")
                # FIX 2: Removed 'await' here too.
                fallback_gen = self.cpu.options(stream=True).get_stream.remote(
                    model_name="qwen2.5:0.5b", 
                    prompt=prompt,
                    target_ui_name="qwen2.5:0.5b"
                )
                async for item in fallback_gen:
                    yield item

        # --- MERGE STREAMS ---
        async def merge_streams():
            queue = asyncio.Queue()

            async def producer(generator_coroutine_or_iterator):
                try:
                    # Handle both raw iterators (from .remote) and async functions (smart_gpu_stream)
                    if hasattr(generator_coroutine_or_iterator, "__aiter__"):
                        iterator = generator_coroutine_or_iterator
                    else:
                        iterator = await generator_coroutine_or_iterator

                    async for item in iterator:
                        await queue.put(item)
                except Exception as e:
                    await queue.put(json.dumps({"error": str(e)}) + "\n")
                finally:
                    await queue.put(None)

            # 1. Start GPU Producer
            # smart_gpu_stream is an async generator function, so we call it directly
            task1 = asyncio.create_task(producer(smart_gpu_stream()))

            # 2. Start Middle Producer
            # FIX 3: Removed 'await'
            middle_gen = self.cpu.options(stream=True).get_stream.remote(
                model_name="qwen2.5:0.5b", prompt=prompt, target_ui_name="qwen3:0.6b"
            )
            task2 = asyncio.create_task(producer(middle_gen))

            # 3. Start Right Producer
            # FIX 4: Removed 'await'
            right_gen = self.cpu.options(stream=True).get_stream.remote(
                model_name="qwen2:0.5b", prompt=prompt, target_ui_name="qwen2:0.5b"
            )
            task3 = asyncio.create_task(producer(right_gen))

            # Consumer Loop
            finished_count = 0
            while finished_count < 3:
                item = await queue.get()
                if item is None:
                    finished_count += 1
                else:
                    yield item

        return StreamingResponse(merge_streams(), media_type="text/event-stream")
# ---------------------------------------------------------
# WIRING
# ---------------------------------------------------------
gpu_deployment = GPUModel.bind()
cpu_deployment = CPUModel.bind()
ingress = Orchestrator.bind(gpu_deployment, cpu_deployment)