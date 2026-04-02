import requests
import json

data = {
    "contamination": 0.05
}

r = requests.post("http://localhost:8000/upload", files={"file": ("test.csv", "A,B\n1,2\n3,4")})
print("Upload status:", r.status_code)

r = requests.get("http://localhost:8000/rename/suggest")
print("Rename suggest status:", r.status_code)
print(r.json())
