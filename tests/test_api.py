import pytest
import allure
from unittest.mock import patch, MagicMock

@allure.suite("API Health & Security")
class TestAPI:

    @allure.title("Health Check Endpoint")
    @allure.description("Verify that the root endpoint is alive and returning 200.")
    def test_health_check(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert "Free-Fiesta" in response.json()["message"]

    @allure.title("Rate Limiter Verification")
    @allure.description("Simulate rapid requests to ensure the 5/minute limit is enforced.")
    def test_rate_limiter_enforcement(self, client):
        # We Mock the network call to the worker. 
        # This allows tests to pass on GitHub Actions where no Worker exists.
        with patch("requests.post") as mock_post:
            
            # Setup the Mock to mimic a successful streaming response
            mock_response = MagicMock()
            mock_response.status_code = 200
            # Mocking the context manager (__enter__) and iter_lines for streaming
            mock_response.__enter__.return_value.iter_lines.return_value = [b"mocked data"]
            mock_post.return_value = mock_response

            # Force a specific IP so the limiter definitely tracks us
            headers = {"X-Real-IP": "10.0.0.1"}

            # 1. Send 5 successful requests
            for i in range(5):
                with allure.step(f"Request {i+1}: Should succeed"):
                    response = client.post(
                        "/stream_compare", 
                        json={"prompt": "test"}, 
                        headers=headers
                    )
                    assert response.status_code == 200

            # 2. The 6th request should be blocked
            with allure.step("Request 6: Should be blocked by Rate Limiter"):
                response = client.post(
                    "/stream_compare", 
                    json={"prompt": "over limit"}, 
                    headers=headers
                )
                assert response.status_code == 429
                # NEW (Passing)
                assert "Rate limit exceeded" in response.text