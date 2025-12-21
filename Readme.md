# Free-Fiesta 🪅
**High-Performance, Rate-Limited LLM Inference Engine on GCP**

Free-Fiesta is a containerized microservices architecture designed to serve Large Language Models (LLMs) efficiently. It features a robust Backend Gateway that protects GPU resources using Rate Limiting and delegates heavy inference tasks to a dedicated Worker node powered by Ray and vLLM.

---

## 🏗 Architecture Overview

The project is split into 3 core services managed via Docker Compose:

1.  **API Gateway (`backend/`)**:
    * **Tech:** FastAPI, SlowAPI.
    * **Role:** The "Bouncer". Handles auth, CORS, and strictly enforces **5 requests/minute per IP**.
    * **Key File:** `backend/app.py`

2.  **Inference Worker (`worker/`)**:
    * **Tech:** Ray, vLLM (GPU), Ollama (CPU Fallback).
    * **Role:** The "Engine". Receives prompts, prioritizes GPU usage, and streams tokens.
    * **Key File:** `worker/worker.py`

3.  **Testing Suite (`tests/`)**:
    * **Tech:** Pytest, Allure, GitHub Actions.
    * **Role:** Automated QA. Verifies health checks and rate limits (using Mocking).

---

## 🛠️ Installation & Setup (GCP VM)

If you are setting this up on a fresh Google Cloud VM (Ubuntu/Debian), follow these steps to install the necessary tools for testing and reporting.

### 1. Install Docker & Docker Compose
Ensure Docker is installed and your user has permission to run it.

### 2. Install Reporting Tools (Allure)
The test reporting dashboard requires Java and the Allure command-line tool.

```bash
# 1. Install Java (Required for Allure)
sudo apt-get update && sudo apt-get install -y default-jre wget

# 2. Download Allure (Latest Stable)
wget [https://github.com/allure-framework/allure2/releases/download/2.36.0/allure_2.36.0-1_all.deb](https://github.com/allure-framework/allure2/releases/download/2.36.0/allure_2.36.0-1_all.deb)

# 3. Install it
sudo dpkg -i allure_2.36.0-1_all.deb

# 4. Verify Installation
allure --version