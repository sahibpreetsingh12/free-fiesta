import pytest
from fastapi.testclient import TestClient
# We are in /app, so app.py is just 'app'
from app import app 

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c