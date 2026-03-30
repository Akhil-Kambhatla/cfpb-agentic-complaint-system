"""LLM client wrapper — uses Anthropic SDK directly."""
import json
import logging
import os
import re
from typing import Optional

import anthropic
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
_client: Optional[anthropic.Anthropic] = None


def get_client() -> anthropic.Anthropic:
    """Return a singleton Anthropic client."""
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set in environment")
        _client = anthropic.Anthropic(api_key=api_key)
        logger.info(f"Anthropic client initialized (model={MODEL})")
    return _client


def ask_claude(
    prompt: str,
    system: str = "You are a helpful assistant.",
    max_tokens: int = 2048,
) -> str:
    """Call Claude and return the text response."""
    client = get_client()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text


def ask_claude_json(
    prompt: str,
    system: str = "You are a helpful assistant. Always respond with valid JSON only, no markdown fences.",
    max_tokens: int = 2048,
    retries: int = 1,
) -> dict:
    """Call Claude and return a parsed JSON dict. Retries once on parse failure."""
    for attempt in range(retries + 1):
        raw = ask_claude(prompt, system=system, max_tokens=max_tokens)
        cleaned = _strip_fences(raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            if attempt < retries:
                logger.warning(f"JSON parse failed (attempt {attempt + 1}): {e}. Retrying...")
            else:
                logger.error(f"JSON parse failed after {retries + 1} attempts. Raw: {raw[:200]}")
                raise


def _strip_fences(text: str) -> str:
    """Strip markdown code fences from a string."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()
