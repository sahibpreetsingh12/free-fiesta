# Free-Fiesta 🪅

**A Dockerized, multi-model LLM comparison tool with a streaming UI, built to explore modern infrastructure and inference technologies.**

Free-Fiesta is a full-stack application that allows you to send a single prompt to multiple Large Language Models (LLMs) and see their responses stream back in real-time. It's built with a microservices architecture using Docker Compose, featuring a Next.js frontend, a FastAPI backend gateway, and a powerful Ray Serve worker for orchestrating inference.

This project was born from a desire to learn and experiment with cutting-edge technologies, including containerization with Docker, service orchestration with Docker Compose, and high-performance Python with Ray. It also sets the stage for future exploration into GPU-accelerated inference with technologies like vLLM.

---

## 🎥 Live Demo

*A brief video walkthrough of Free-Fiesta in action.*

[![Watch the video](https://img.youtube.com/vi/zKO5R7vcF9E/maxresdefault.jpg)](https://youtu.be/zKO5R7vcF9E)

---

## 🚀 About The Project

This project serves as a practical, hands-on guide to building a complex, real-time application with modern tools. It tackles several key challenges:

- **Real-Time Streaming:** How do you handle multiple, simultaneous data streams from different models and display them cleanly in a web UI?
- **Scalable Architecture:** How can you separate concerns (UI, API, and processing) into independent services that can be scaled and maintained separately?
- **Resource Protection:** How do you prevent a public-facing service from being overwhelmed? (Hint: Rate Limiting!)
- **CPU/GPU Workloads:** How can you structure an application to be ready for both CPU-based inference and more powerful GPU-based serving?

### What Can You Learn?

- **Docker & Docker Compose:** Understand how to containerize individual services (Next.js, FastAPI, Python workers) and link them together to create a cohesive application.
- **Ray Serve:** Get introduced to deploying and orchestrating multiple machine learning models as a scalable, programmable API.
- **FastAPI:** Learn how to build a simple but effective API gateway with middleware for features like CORS and rate limiting.
- **Next.js & React Hooks:** See how to build a dynamic, responsive frontend that communicates with a streaming backend.

---

## 🏗️ Key Components

The project is split into four core services managed via `docker-compose.yml`:

1.  **UI (`ui/`)**:
    *   **Tech:** Next.js, React
    *   **Role:** The user-facing application. It provides the input form and renders the side-by-side streaming model outputs.
    *   **Key File:** `ui/app/hooks/useModelStreams.js` (for backend communication).

2.  **API Gateway (`backend/`)**:
    *   **Tech:** FastAPI, SlowAPI
    *   **Role:** The public entry point. It handles CORS and applies a **5 requests/minute per IP** rate limit to protect the system from abuse before forwarding requests to the worker.
    *   **Key File:** `backend/app.py`

3.  **Inference Worker (`worker/`)**:
    *   **Tech:** Ray Serve
    *   **Role:** The "brains" of the operation. It receives prompts from the API gateway and orchestrates concurrent inference requests to the `ollama` service.
    *   **Key File:** `worker/ray_app.py`

4.  **Inference Engine (`ollama/`)**:
    *   **Tech:** Ollama
    *   **Role:** The engine that runs the actual LLMs. It is initialized on startup to download and serve the models specified in `startup/ollama-init.sh`.

---

## 🔒 Security & Lessons Learned

A critical part of this learning journey was understanding the security implications of deploying services to the public internet. Here are two key takeaways:

### 1. Application-Layer Security: Rate Limiting

To prevent the inference service from being overwhelmed by too many requests, the API Gateway uses **SlowAPI**. This is a simple and effective way to add rate-limiting middleware to a FastAPI application, and it's configured to allow a maximum of 5 requests per minute from any single IP address.

### 2. Infrastructure-Layer Security: A Cautionary Tale

During development, the application was deployed on a cloud VM with all ports temporarily opened for testing (`0.0.0.0/0`). This accidentally exposed the **Ray dashboard port (8265)** to the public internet without any authentication.

**The result?** An attacker found the open port and used the server to launch a DDoS attack, consuming all its resources.

**The Fix:** The immediate solution was to implement a strict firewall rule that whitelisted only my personal IP address, blocking all other external traffic. To make this manageable, I created a script called `update_firewall.sh` to quickly update the firewall with my current IP address. This serves as a powerful reminder: **never expose more than you need to**, and always be mindful of the default ports used by frameworks like Ray.

---

## 🛠️ Getting Started & Replication

Follow these steps to get the project running on your own machine.

### Prerequisites

-   **Docker:** [Install Docker](https://docs.docker.com/get-docker/)
-   **Docker Compose:** [Install Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop).

### 1. Running the Project

Once the prerequisites are installed, you can launch the entire application with a single command:

```bash
docker-compose up --build
```

This will build the images for each service, download the necessary LLMs, and start everything up. You can then access the UI in your browser at `http://localhost:3000`.

### 1.1 Clean Build and Run (Development)

For a complete refresh, especially during development or after significant changes, you might want to stop, clean, rebuild (without cache), and restart all services. This ensures you're working with the freshest images.

```bash
docker compose down && docker system prune -a && docker compose build --no-cache  --progress=plain && docker compose up -d
```

### 2. Replicating on Your Own VM

If you are deploying this project to a Virtual Machine or another server, you will need to update the hardcoded URLs to use your machine's public IP address instead of `localhost`.

1.  **Frontend (UI):**
    *   **File:** `ui/app/hooks/useModelStreams.js`
    *   **Change:** In the `fetch` call, replace the `http://localhost:8000` part of the URL with your server's public IP and the corresponding port.

2.  **Backend (API Gateway):**
    *   **File:** `backend/app.py`
    *   **Change:** Update the `WORKER_URL` environment variable to point to the correct address of your worker service. In the default `docker-compose.yml` setup, this is handled by Docker's internal networking (`http://worker:8080`), so you would only need to change this if you were running the services outside of the composed environment.

### 2.1 Viewing Logs

To inspect the output and troubleshoot any issues with your running services, you can check the Docker Compose logs:

```bash
docker compose logs -f
```

To view logs for a specific service (e.g., `api`):

```bash
docker compose logs -f api
```

### 3. Testing & Reporting (Optional)

The test suite uses Pytest and generates beautiful reports with Allure. To set this up, you'll need Java and the Allure command-line tool.

```bash
# For Debian/Ubuntu-based systems

# 1. Install Java (Required for Allure)
sudo apt-get update && sudo apt-get install -y default-jre wget

# 2. Download Allure
wget https://github.com/allure-framework/allure2/releases/download/2.30.0/allure_2.30.0-1_all.deb

# 3. Install it
sudo dpkg -i allure_2.30.0-1_all.deb

# 4. Verify Installation
allure --version
```

Once installed, you can run the tests and generate a report:

```bash
# From the project root directory
./run_tests.sh
```
