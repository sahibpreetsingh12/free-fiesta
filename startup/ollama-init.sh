#!/bin/sh

echo "Starting Ollama service..."
ollama serve &
sleep 5  # wait for the server to start

echo "Pulling required models..."

ollama pull qwen2.5:0.5b
ollama pull qwen3:0.6b
ollama pull qwen2:0.5b

echo "All models downloaded successfully!"

wait  # keep ollama running

