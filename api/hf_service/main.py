from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import time
from config import MODEL_1_URL, MODEL_2_URL, MODEL_3_URL, MAX_RETRIES
from hf_client import call_hf_api
from router import route_text
from logger import setup_logger

logger = setup_logger("main")

app = FastAPI(title="HF Inference Router")

class PredictRequest(BaseModel):
    text: str

class PredictResponse(BaseModel):
    status: str
    model_used: str
    response: dict | list | str | None
    latency: str
    fallback_used: bool

# Simple in-memory cache
cache = {}

def get_url_by_model_name(model_name: str) -> str:
    if model_name == "MODEL_1":
        return MODEL_1_URL
    elif model_name == "MODEL_3":
        return MODEL_3_URL
    else:
        return MODEL_2_URL

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    text = request.text

    # Check cache
    if text in cache:
        logger.info(f"Cache hit for text: {text[:20]}...")
        return cache[text]

    start_time = time.time()

    # Routing
    selected_model_name = route_text(text)
    selected_url = get_url_by_model_name(selected_model_name)
    logger.info(f"Routed text to {selected_model_name} ({selected_url})")

    fallback_used = False

    # Attempt primary model
    logger.info(f"Calling primary model {selected_model_name}")
    result = await call_hf_api(selected_url, text, max_retries=MAX_RETRIES)

    if result["status"] == "error":
        logger.warning(f"Primary model {selected_model_name} failed. Initiating fallback to MODEL_2.")
        fallback_used = True
        selected_model_name = "MODEL_2"
        selected_url = get_url_by_model_name(selected_model_name)

        # Attempt fallback model
        result = await call_hf_api(selected_url, text, max_retries=MAX_RETRIES)

        if result["status"] == "error":
            logger.error("Fallback model MODEL_2 also failed.")
            latency = f"{time.time() - start_time:.2f}s"
            return PredictResponse(
                status="error",
                model_used=selected_model_name,
                response={"error": "All models failed including fallback.", "details": result.get("error")},
                latency=latency,
                fallback_used=fallback_used
            )

    latency = f"{time.time() - start_time:.2f}s"
    logger.info(f"Successful response from {selected_model_name}. Latency: {latency}")

    response_obj = PredictResponse(
        status="success",
        model_used=selected_model_name,
        response=result["data"],
        latency=latency,
        fallback_used=fallback_used
    )

    # Save to cache
    cache[text] = response_obj
    return response_obj

@app.get("/health")
async def health():
    return {"status": "ok"}
