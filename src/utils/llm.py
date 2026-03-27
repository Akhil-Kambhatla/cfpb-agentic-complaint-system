"""LLM client wrapper — supports Anthropic (Claude) and OpenAI with automatic fallback."""
import json
import logging
from typing import Optional

from src.config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    LLM_PROVIDER,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)

logger = logging.getLogger(__name__)


def get_llm_client():
    """Return the appropriate LangChain chat model based on available API keys."""
    if LLM_PROVIDER == "anthropic":
        from langchain_anthropic import ChatAnthropic

        logger.info(f"Using Anthropic ({ANTHROPIC_MODEL})")
        return ChatAnthropic(
            model=ANTHROPIC_MODEL,
            api_key=ANTHROPIC_API_KEY,
            temperature=0.1,
            max_tokens=4096,
        )
    elif LLM_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI

        logger.info(f"Using OpenAI ({OPENAI_MODEL})")
        return ChatOpenAI(
            model=OPENAI_MODEL,
            api_key=OPENAI_API_KEY,
            temperature=0.1,
            max_tokens=4096,
        )
    else:
        raise ValueError(
            "No LLM API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env"
        )


def call_llm_structured(
    prompt: str,
    system_prompt: str = "",
    response_format: Optional[dict] = None,
) -> str:
    """Call the LLM and return the text response. Handles both providers."""
    client = get_llm_client()
    messages = []
    if system_prompt:
        from langchain_core.messages import HumanMessage, SystemMessage

        messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))
    else:
        from langchain_core.messages import HumanMessage

        messages.append(HumanMessage(content=prompt))

    response = client.invoke(messages)
    return response.content


def call_llm_json(
    prompt: str,
    system_prompt: str = "You are a helpful assistant. Always respond with valid JSON only, no markdown fences.",
) -> dict:
    """Call the LLM and parse the response as JSON."""
    raw = call_llm_structured(prompt, system_prompt=system_prompt)
    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return json.loads(cleaned.strip())
