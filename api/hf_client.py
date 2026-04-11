import os
import requests
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_1_URL = os.getenv("MODEL_1_URL", "https://api-inference.huggingface.co/models/Ansh1419/xlm-emo-sence-model")
MODEL_2_URL = os.getenv("MODEL_2_URL", "https://api-inference.huggingface.co/models/Ansh1419/xlm-emo-sence-model")
MODEL_3_URL = os.getenv("MODEL_3_URL", "https://api-inference.huggingface.co/models/Ansh1419/xlm-emo-sence-model")

TIMEOUT = 10.0
MAX_RETRIES = 2

def call_hf_api(url: str, text: str) -> dict:
    if not url:
        return {"error": "Model URL not configured."}

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }

    # Standard HF inference payload
    payload = {"inputs": text}

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=TIMEOUT)

            # If the response is not JSON, handle gracefully instead of crashing
            try:
                data = response.json()
            except ValueError:
                if response.status_code == 503 and attempt < MAX_RETRIES:
                    import time
                    time.sleep(2 ** attempt)
                    continue
                return {"status": "error", "error": f"Invalid JSON response. Status code: {response.status_code}"}

            response.raise_for_status()
            return {"status": "success", "data": data}

        except requests.exceptions.HTTPError as e:
            # Handle specific API errors, e.g., model loading (503)
            if response.status_code == 503 and attempt < MAX_RETRIES:
                import time
                time.sleep(2 ** attempt)  # Exponential backoff while waking up
                continue
            # Try to return the JSON error detail if available, else text
            error_msg = data.get("error", response.text) if isinstance(data, dict) else response.text
            return {"status": "error", "error": f"HTTP Error: {error_msg}"}
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES:
                import time
                time.sleep(2 ** attempt)
                continue
            return {"status": "error", "error": str(e)}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    return {"status": "error", "error": "Max retries exceeded."}
