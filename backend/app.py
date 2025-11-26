from fastapi import FastAPI

import requests

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Free-Fiesta API is running!"}

@app.get("/trigger-task")
def trigger_task():
    response = requests.get("http://worker:9000/run")
    return {"worker_response": response.json()}


@app.post("/compare")
def compare(data: dict):
    res = requests.post("http://worker:9000/compare", json=data)
    return res.json()
