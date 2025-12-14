FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip git

# Install vLLM
RUN pip install vllm transformers accelerate

# Expose vLLM API port
EXPOSE 8001

# Run script
COPY run.sh /run.sh
RUN chmod +x /run.sh

ENTRYPOINT ["/run.sh"]

