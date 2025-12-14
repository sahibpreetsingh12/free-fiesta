#!/bin/bash

vllm serve \
  $MODEL_NAME \
  --port 8001 \
  --max-model-len 4096

