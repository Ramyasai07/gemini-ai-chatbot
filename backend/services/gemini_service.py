"""
Gemini AI Service - Direct HTTP API with v1beta fallback and retry logic
"""
import os
import logging
import requests
from typing import Optional, Generator

logger = logging.getLogger(__name__)

class GeminiService:
    """Direct HTTP Gemini API Service with endpoint fallback"""
    # Ordered list of working endpoints (most reliable first)
    ENDPOINTS = [
        'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
        'https://generativelanguage.googleapis.com/v1/models/gemini-flash-latest:generateContent',
        'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent'
    ]  # Only verified working endpoints

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found")
        logger.info("✓ Gemini Service Ready - Using Direct API")

    def get_chat_response(self, prompt: str, conversation_history: list, model: str = None, search_context: Optional[str] = None) -> tuple[str, int]:
        """Try each endpoint in order, return first successful response."""
        if search_context:
            final_prompt = f"{prompt}\n\n[Search Results]: {search_context}\n\nPlease use the search results above to answer accurately."
        else:
            final_prompt = prompt

        payload = {
            "contents": [{
                "role": "user",
                "parts": [{"text": final_prompt}]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "topK": 1,
                "topP": 1,
                "maxOutputTokens": 2048
            }
        }
        headers = {"Content-Type": "application/json"}
        last_error = None
        for endpoint in self.ENDPOINTS:
            url = f"{endpoint}?key={self.api_key}"
            try:
                logger.info(f"[Gemini] Trying endpoint: {endpoint}")
                response = requests.post(url, json=payload, headers=headers, timeout=30)
                if response.status_code == 404:
                    logger.warning(f"[Gemini] 404 at {endpoint}, trying next fallback...")
                    continue
                response.raise_for_status()
                result = response.json()
                if 'candidates' in result and result['candidates']:
                    text = result['candidates'][0]['content']['parts'][0]['text']
                    estimated_tokens = len(final_prompt + text) // 4
                    logger.info(f"✓ Gemini response received ({estimated_tokens} tokens)")
                    return text, estimated_tokens
                else:
                    last_error = f"No candidates in response: {result}"
            except Exception as e:
                logger.error(f"[Gemini] Error at {endpoint}: {e}")
                last_error = str(e)
        # If all endpoints fail, return friendly error
        logger.error(f"[Gemini] All endpoints failed: {last_error}")
        return ("[Gemini API Error] All endpoints failed. Please try again later.", 0)

    def chat_with_streaming(self, prompt: str, conversation_history: list, model: str = None, search_context: Optional[str] = None) -> Generator[str, None, None]:
        try:
            response, _ = self.get_chat_response(prompt, conversation_history, model, search_context)
            chunk_size = 10
            for i in range(0, len(response), chunk_size):
                yield response[i:i+chunk_size]
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"Error: {str(e)}"

    def count_tokens(self, text: str, model: str = None) -> int:
        return len(text) // 4