import os
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_1_URL = os.getenv("MODEL_1_URL", "https://api-inference.huggingface.co/models/default-model-1")
MODEL_2_URL = os.getenv("MODEL_2_URL", "https://api-inference.huggingface.co/models/default-model-2")
MODEL_3_URL = os.getenv("MODEL_3_URL", "https://api-inference.huggingface.co/models/default-model-3")

# Timeouts and Retry logic
TIMEOUT = 10.0
MAX_RETRIES = 2
