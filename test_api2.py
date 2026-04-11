import requests
import json

data = {"text": "Yaar aaj ka din bahut bakwaas tha, sab kuch galat ho gaya! 😂 lol idk kya karu ab"}
response = requests.post("http://localhost:8000/api/nlp/predict/smart", json=data)
print(json.dumps(response.json(), indent=2))
