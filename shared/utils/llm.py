from tenacity import retry, stop_after_attempt, wait_exponential
import logging

logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
async def call_llm_with_retry(client, model, messages, max_tokens, temperature):
    """Call LLM with exponential backoff and 404 fallback to raw API."""
    try:
        # 1. Try modern Chat Completions (OpenAI/OpenRouter style)
        return await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        )
    except Exception as e:
        error_str = str(e)
        # 2. If it's a 404 or "Not Found", try the raw Hugging Face Inference API
        if "404" in error_str or "Not Found" in error_str:
            try:
                logger.info(f"Chat API 404'd. Falling back to raw text_generation for {model}")
                # Combine messages into a single prompt for raw completion
                prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
                response = await client.text_generation(
                    prompt=prompt,
                    model=model,
                    max_new_tokens=max_tokens,
                    temperature=temperature
                )
                return response # Return raw string, orchestrator handles it
            except Exception as e2:
                logger.error(f"Fallback raw API failed: {e2}")
                raise e
        
        logger.error(f"LLM Call failed: {e}")
        raise e
