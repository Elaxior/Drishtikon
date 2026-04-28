from __future__ import annotations

import json
import re
from typing import Any
from typing import Optional, Tuple

from app.core.config import settings
from app.core.llm import get_groq_client

_SOCIAL_PATTERNS: dict[str, str] = {
    "instagram_reel": r"instagram\.com/reel/",
    "instagram_post": r"instagram\.com/p/",
    "facebook": r"facebook\.com|fb\.watch",
    "x_twitter": r"x\.com|twitter\.com",
    "youtube_shorts": r"youtube\.com/shorts/",
    "tiktok": r"tiktok\.com",
}

_NO_VERIFIABLE_CLAIM = "No verifiable factual claim detected."


def detect_social_media_platform(url_or_text: str) -> Tuple[Optional[str], bool]:
    """
    Returns (platform_name, is_social_media_url).
    """
    candidate = (url_or_text or "").strip().lower()

    for platform_key, pattern in _SOCIAL_PATTERNS.items():
        if re.search(pattern, candidate):
            return platform_key.replace("_", " ").title(), True

    if not candidate.startswith("http"):
        return None, False

    return None, False


def _safe_claim_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split()).strip()


def _extract_claim_from_llm_content(content: str) -> str:
    text = _safe_claim_text(content)
    if not text:
        return ""

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        # If model did not return valid JSON, use plain text safely.
        return text

    extracted_claim = _safe_claim_text(payload.get("extracted_claim"))
    if extracted_claim:
        return extracted_claim

    claims = payload.get("claims")
    if isinstance(claims, list):
        for claim in claims:
            normalized = _safe_claim_text(claim)
            if normalized:
                return normalized

    return ""


def extract_claim_from_social_media(input_text: str, platform: str | None = None) -> dict[str, Any]:
    """
    Extracts a core factual claim from social media URL/text for downstream news search.
    """
    original_input = _safe_claim_text(input_text)[:500]
    client = get_groq_client()

    if client is None:
        return {
            "original_input": original_input,
            "platform": platform,
            "extracted_claim": original_input[:300],
            "is_social_media": True,
            "success": False,
            "error": "Groq client is not configured.",
        }

    system_prompt = (
        "You are a neutral fact-extraction AI. "
        "Extract ONLY the core factual claim from social-media content. "
        "Ignore hype, opinions, emotions, and speculation. "
        "Return JSON in this shape: {\"extracted_claim\": \"...\", \"claims\": [\"...\"]}. "
        "If no clear factual claim exists, set extracted_claim to \"No verifiable factual claim detected.\""
    )

    user_prompt = (
        f"Platform: {platform or 'Unknown'}\n"
        "Content:\n"
        f"{input_text}\n\n"
        "Extract the main factual claim(s)."
    )

    try:
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        return {
            "original_input": original_input,
            "platform": platform,
            "extracted_claim": original_input[:300],
            "is_social_media": True,
            "success": False,
            "error": str(exc),
        }

    content = ""
    if response.choices and response.choices[0].message and response.choices[0].message.content:
        content = response.choices[0].message.content

    extracted_claim = _extract_claim_from_llm_content(content)
    if not extracted_claim:
        extracted_claim = _NO_VERIFIABLE_CLAIM

    return {
        "original_input": original_input,
        "platform": platform,
        "extracted_claim": extracted_claim,
        "is_social_media": True,
        "success": extracted_claim != _NO_VERIFIABLE_CLAIM,
    }
