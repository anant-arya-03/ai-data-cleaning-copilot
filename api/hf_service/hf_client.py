import httpx
import asyncio
from config import HF_TOKEN, TIMEOUT
from logger import setup_logger

logger = setup_logger("hf_client")

async def call_hf_api(url: str, text: str, max_retries: int = 2) -> dict:
    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {"inputs": text}

    # Using async with so we can easily leverage httpx.AsyncClient
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(max_retries + 1):
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                return {"status": "success", "data": response.json()}
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTPStatusError on attempt {attempt + 1}: {e.response.text}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                else:
                    return {"status": "error", "error": str(e)}
            except httpx.RequestError as e:
                logger.error(f"RequestError on attempt {attempt + 1}: {str(e)}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return {"status": "error", "error": str(e)}
            except Exception as e:
                logger.error(f"Unexpected error on attempt {attempt + 1}: {str(e)}")
                if attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return {"status": "error", "error": str(e)}
