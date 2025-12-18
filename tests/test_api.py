import pytest
import allure
import time

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
        # Force a specific IP so the limiter definitely tracks us
        headers = {"X-Real-IP": "10.0.0.1"}

        # 1. Send 5 successful requests
        for i in range(5):
            with allure.step(f"Request {i+1}: Should succeed"):
                response = client.post("/stream_compare", json={"prompt": "test"}, headers=headers)
                assert response.status_code == 200

        # 2. The 6th request should be blocked
        with allure.step("Request 6: Should be blocked by Rate Limiter"):
            response = client.post("/stream_compare", json={"prompt": "over limit"}, headers=headers)
            # If this still fails, your Limiter setup in app.py might be missing the Middleware
            assert response.status_code == 429
        # 1. Send 5 successful requests (Assuming your limit is 5/minute)
        for i in range(5):
            with allure.step(f"Request {i+1}: Should succeed"):
                response = client.post("/stream_compare", json={"prompt": "test"})
                assert response.status_code == 200

        # 2. The 6th request should be blocked
        with allure.step("Request 6: Should be blocked by Rate Limiter"):
            response = client.post("/stream_compare", json={"prompt": "over limit"})
            assert response.status_code == 429
            assert "Too many requests" in response.text