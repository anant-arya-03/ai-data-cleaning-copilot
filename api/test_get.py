from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_api_root():
    response = client.get("/api/")
    assert response.status_code == 200
    assert "endpoints" in response.json()
    print("GET /api/ passed!")

def test_nlp_test_missing_text():
    response = client.get("/api/nlp/test")
    assert response.status_code == 422 # FastAPI validation error for missing required param
    print("GET /api/nlp/test (missing text) passed!")

def test_nlp_test():
    # Will fail network but should route correctly
    response = client.get("/api/nlp/test?text=hello world")
    assert response.status_code == 200
    assert "text_analysis" in response.json()
    print("GET /api/nlp/test passed!")

print("Running GET route tests...")
test_api_root()
test_nlp_test_missing_text()
test_nlp_test()
print("All tests passed!")
