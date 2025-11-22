from fastapi import FastAPI
import ray

app = FastAPI()

ray.init(ignore_reinit_error=True)

@app.get("/run")
def run_parallel_tasks():

    @ray.remote
    def task(n):
        return f"Task {n} completed!"

    futures = [task.remote(i) for i in range(5)]
    results = ray.get(futures)

    return {"results": results}

