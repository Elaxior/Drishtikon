from __future__ import annotations

import json
import re
from html import unescape
from typing import Any
from typing import Optional, Tuple
from urllib.parse import quote_plus, unquote, urlparse

import requests

from app.core.config import settings
from app.core.llm import get_groq_client

_SOCIAL_PATTERNS: dict[str, str] = {
    "Instagram": r"(?:instagram\.com/(?:reel|p|tv)/|instagr\.am/)",
    "Facebook": r"(?:facebook\.com|fb\.watch)",
    "X / Twitter": r"(?:x\.com|twitter\.com|t\.co/)",
    "YouTube": r"(?:youtube\.com|youtu\.be)",
    "TikTok": r"(?:tiktok\.com|vm\.tiktok\.com)",
    "Reddit": r"(?:reddit\.com|redd\.it)",
    "LinkedIn": r"linkedin\.com",
}

_NO_VERIFIABLE_CLAIM = "No verifiable factual claim detected."
_MAX_CONTEXT_CHARS = 1500
_REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
}
_URL_PATTERN = re.compile(r"https?://[^\s<>()\[\]{}\"']+", re.IGNORECASE)
_META_TAG_PATTERN = re.compile(
    r"<meta[^>]+(?:property|name)=[\"'](?P<key>[^\"']+)[\"'][^>]+content=[\"'](?P<value>[^\"']+)[\"'][^>]*>",
    re.IGNORECASE,
)
_TITLE_PATTERN = re.compile(r"<title[^>]*>(?P<title>.*?)</title>", re.IGNORECASE | re.DOTALL)
_URL_STRIP_PATTERN = re.compile(r"https?://\S+", re.IGNORECASE)
_MENTION_PATTERN = re.compile(r"@[A-Za-z0-9_\.]+")
_HASHTAG_PATTERN = re.compile(r"#")
_NON_WORD_PATTERN = re.compile(r"[^\w\s\-]", re.UNICODE)
_MULTISPACE_PATTERN = re.compile(r"\s+")


def _extract_first_url(url_or_text: str) -> str | None:
    match = _URL_PATTERN.search(url_or_text or "")
    if not match:
        return None
    return match.group(0).rstrip(".,;:!?)\"")


def _extract_meta_value(html: str, keys: tuple[str, ...]) -> str:
    lowered_keys = {key.lower() for key in keys}
    for match in _META_TAG_PATTERN.finditer(html):
        key = (match.group("key") or "").strip().lower()
        value = (match.group("value") or "").strip()
        if key in lowered_keys and value:
            return unescape(value)
    return ""


def _extract_title(html: str) -> str:
    title_match = _TITLE_PATTERN.search(html)
    if not title_match:
        return ""
    return _safe_claim_text(unescape(title_match.group("title") or ""))


def _clean_for_query(text: str) -> str:
    cleaned = _safe_claim_text(text)
    cleaned = _URL_STRIP_PATTERN.sub(" ", cleaned)
    cleaned = _MENTION_PATTERN.sub(" ", cleaned)
    cleaned = _HASHTAG_PATTERN.sub("", cleaned)
    cleaned = _NON_WORD_PATTERN.sub(" ", cleaned)
    cleaned = _MULTISPACE_PATTERN.sub(" ", cleaned).strip(" -")
    if not cleaned:
        return ""
    words = cleaned.split()
    return " ".join(words[:18])


def _fetch_page_metadata(url: str) -> dict[str, str]:
    try:
        response = requests.get(url, timeout=10, headers=_REQUEST_HEADERS)
        response.raise_for_status()
    except Exception:
        return {}

    html = response.text or ""
    if not html:
        return {}

    title = _extract_meta_value(html, ("og:title", "twitter:title")) or _extract_title(html)
    description = _extract_meta_value(
        html,
        ("og:description", "twitter:description", "description"),
    )
    site_name = _extract_meta_value(html, ("og:site_name",))

    data: dict[str, str] = {}
    if title:
        data["title"] = title
    if description:
        data["description"] = description
    if site_name:
        data["site_name"] = site_name
    return data


def _fetch_oembed_metadata(url: str, platform: str | None) -> dict[str, str]:
    if not platform:
        return {}

    platform_key = platform.lower()
    if platform_key.startswith("youtube"):
        endpoint = f"https://www.youtube.com/oembed?url={quote_plus(url)}&format=json"
    elif "twitter" in platform_key or platform_key.startswith("x"):
        endpoint = f"https://publish.twitter.com/oembed?url={quote_plus(url)}"
    else:
        return {}

    try:
        response = requests.get(endpoint, timeout=10, headers=_REQUEST_HEADERS)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        return {}

    data: dict[str, str] = {}
    title = _safe_claim_text(payload.get("title"))
    author = _safe_claim_text(payload.get("author_name"))
    provider = _safe_claim_text(payload.get("provider_name"))
    if title:
        data["title"] = title
    if author:
        data["author"] = author
    if provider:
        data["site_name"] = provider
    return data


def _compose_context_text(original_input: str, metadata: dict[str, str]) -> str:
    parts = [f"Original input: {original_input}"]

    if metadata.get("title"):
        parts.append(f"Post title: {metadata['title']}")
    if metadata.get("description"):
        parts.append(f"Post description: {metadata['description']}")
    if metadata.get("author"):
        parts.append(f"Author: {metadata['author']}")
    if metadata.get("site_name"):
        parts.append(f"Platform/site: {metadata['site_name']}")

    combined = "\n".join(parts)
    return combined[:_MAX_CONTEXT_CHARS]


def _query_from_social_url(url: str | None) -> str:
    if not url:
        return ""

    try:
        parsed = urlparse(url)
    except Exception:
        return ""

    raw_parts = [part for part in parsed.path.split("/") if part]
    if not raw_parts:
        return ""

    useful_parts: list[str] = []
    for part in raw_parts:
        decoded = unquote(part)
        cleaned = re.sub(r"[_\-]+", " ", decoded)
        cleaned = _clean_for_query(cleaned)
        if not cleaned:
            continue
        if cleaned.lower() in {"reel", "shorts", "status", "video", "watch", "p", "tv"}:
            continue
        useful_parts.append(cleaned)

    if not useful_parts:
        return ""

    return _clean_for_query(" ".join(useful_parts))[:220]


def _fallback_search_query(original_input: str, metadata: dict[str, str]) -> str:
    for key in ("title", "description"):
        value = _clean_for_query(metadata.get(key, ""))
        if value:
            return value

    social_url = _extract_first_url(original_input)
    url_based = _query_from_social_url(social_url)
    if url_based:
        return url_based

    return _clean_for_query(original_input)[:220]


def _build_derived_search_query(extracted_claim: str, original_input: str, metadata: dict[str, str]) -> str:
    cleaned_claim = _clean_for_query(extracted_claim)
    if cleaned_claim and cleaned_claim.lower() != _NO_VERIFIABLE_CLAIM.lower():
        return cleaned_claim[:220]

    return _fallback_search_query(original_input, metadata)[:220]


def detect_social_media_platform(url_or_text: str) -> Tuple[Optional[str], bool]:
    """
    Returns (platform_name, is_social_media_url_or_text).
    """
    candidate_raw = (url_or_text or "").strip()
    candidate = candidate_raw.lower()
    social_url = _extract_first_url(candidate_raw)

    if social_url:
        url_candidate = social_url.lower()
        for platform_name, pattern in _SOCIAL_PATTERNS.items():
            if re.search(pattern, url_candidate):
                return platform_name, True

    for platform_name, pattern in _SOCIAL_PATTERNS.items():
        if re.search(pattern, candidate):
            return platform_name, True

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
    social_url = _extract_first_url(original_input)

    oembed_metadata = _fetch_oembed_metadata(social_url, platform) if social_url else {}
    page_metadata = _fetch_page_metadata(social_url) if social_url else {}
    metadata = {**page_metadata, **oembed_metadata}

    fallback_query = _fallback_search_query(original_input, metadata)
    client = get_groq_client()

    if client is None:
        return {
            "original_input": original_input,
            "platform": platform,
            "social_url": social_url,
            "extracted_claim": fallback_query,
            "derived_search_query": fallback_query,
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
        "Input context:\n"
        f"{_compose_context_text(original_input, metadata)}\n\n"
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
            "social_url": social_url,
            "extracted_claim": fallback_query,
            "derived_search_query": fallback_query,
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

    derived_search_query = _build_derived_search_query(extracted_claim, original_input, metadata)

    return {
        "original_input": original_input,
        "platform": platform,
        "social_url": social_url,
        "extracted_claim": extracted_claim,
        "derived_search_query": derived_search_query,
        "is_social_media": True,
        "success": extracted_claim != _NO_VERIFIABLE_CLAIM and bool(derived_search_query),
    }
