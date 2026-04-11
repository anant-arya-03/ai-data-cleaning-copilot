from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Backend is running 🚀"}

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_nlp_health():
    response = client.get("/api/nlp/health")
    assert response.status_code == 200
    assert response.json() == {"status": "online"}

print("Running tests...")
test_root()
test_health()
test_nlp_health()
print("All tests passed!")
