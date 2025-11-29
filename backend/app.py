from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKER_URL = "http://worker:9000"


@app.get("/")
def root():
    return {"message": "Free-Fiesta API is running!"}


@app.post("/compare")
def compare(data: dict):
    res = requests.post(f"{WORKER_URL}/compare", json=data)
    return res.json()


@app.post("/stream_compare")
async def stream_compare(payload: dict):

    def generate():
        with requests.post(
            f"{WORKER_URL}/stream_compare",
            json=payload,
            stream=True
        ) as r:
            for line in r.iter_lines():
                if line:
                    yield line.decode() + "\n"

    return StreamingResponse(generate(), media_type="text/plain")
