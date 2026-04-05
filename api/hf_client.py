import os
import requests
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_1_URL = os.getenv("MODEL_1_URL", "https://router.huggingface.co/models/your-misinfo-model")
MODEL_2_URL = os.getenv("MODEL_2_URL", "https://router.huggingface.co/models/your-fakenews-model")
MODEL_3_URL = os.getenv("MODEL_3_URL", "https://router.huggingface.co/models/your-emosen-model")

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
            response.raise_for_status()
            data = response.json()

            # Hugging Face usually returns a list of lists of dicts for classification: [[{"label": "...", "score": ...}, ...]]
            # Or just a list of dicts.
            return {"status": "success", "data": data}
        except requests.exceptions.HTTPError as e:
            # Handle specific API errors, e.g., model loading (503)
            if response.status_code == 503 and attempt < MAX_RETRIES:
                import time
                time.sleep(2 ** attempt)  # Exponential backoff while waking up
                continue
            return {"status": "error", "error": f"HTTP Error: {response.text}"}
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES:
                import time
                time.sleep(2 ** attempt)
                continue
            return {"status": "error", "error": str(e)}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    return {"status": "error", "error": "Max retries exceeded."}
