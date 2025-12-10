# Free Fiesta

This project is a web application that allows you to compare different large language models.

## Running the project

To run the project, you need to have Docker and Docker Compose installed. Then, you can run the following command:

```bash
docker-compose up -d
```

This will start all the services, including the UI, backend, worker, and the LLM.

## Monitoring

This project uses Prometheus and Grafana for monitoring.

### Prometheus

Prometheus is available at [http://localhost:9090](http://localhost:9090).

You can use the Prometheus UI to query the metrics. The following metrics are available:

*   `http_requests_total`: Total number of HTTP requests.
*   `http_request_latency_seconds`: HTTP request latency in seconds.
*   `http_request_ttft_seconds`: Time to first token in seconds.
*   `llm_tokens_generated_total`: Total number of LLM tokens generated.
*   `llm_tokens_per_second`: LLM tokens per second.

### Grafana

Grafana is available at [http://localhost:3001](http://localhost:3001).

A pre-configured dashboard is available to visualize the metrics.
