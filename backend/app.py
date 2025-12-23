from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import StreamingResponse
import requests

# --- NEW: Custom Key Function ---
def get_real_ip(request: Request):
    # 1. Check if we have a specific header (from Nginx, Cloudflare, or our Test)
    if request.headers.get("X-Real-IP"):
        return request.headers.get("X-Real-IP")
    # 2. Fallback to the standard connection
    return get_remote_address(request)

# 1. Initialize Limiter
limiter = Limiter(key_func=get_real_ip)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

WORKER_URL = "http://worker:9000"


@app.get("/")
def root():
    return {"message": "Free-Fiesta API is running!"}


@app.post("/compare")
def compare(data: dict):
    res = requests.post(f"{WORKER_URL}/compare", json=data)
    return res.json()



@app.post("/stream_compare")
@limiter.limit("5/minute") # Prevents users from draining GPU days
async def stream_compare(request: Request, payload: dict): # 'request' arg is mandatory for SlowAPI
    def generate():
        with requests.post(f"{WORKER_URL}/stream_compare", json=payload, stream=True) as r:
            for line in r.iter_lines():
                if line: yield line.decode() + "\n"
    return StreamingResponse(generate(), media_type="text/plain")