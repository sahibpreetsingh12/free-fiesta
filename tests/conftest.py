import pytest
from fastapi.testclient import TestClient
from app import app # Ensure this points to where your FastAPI 'app' is defined

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c