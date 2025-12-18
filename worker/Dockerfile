FROM python:3.10

WORKDIR /app

# Install system dependencies for Allure/Java if needed later
RUN apt-get update && apt-get install -y default-jre wget && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copying code (Volumes will override this during dev, but good for production)
COPY . .

CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "9000"]