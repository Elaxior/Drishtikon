from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import requests
from fastapi import APIRouter, HTTPException

from app.core.bias import get_bias
from app.core.config import settings

router = APIRouter(tags=["trending"])

CACHE: dict[str, Any] = {
    "data": None,
    "last_updated": None,
}
CACHE_TTL = timedelta(minutes=10)
CACHE_LOCK = Lock()
SECTION_SIZE = 5

WAR_QUERY = "(ukraine OR russia OR gaza OR israel OR sudan OR myanmar)"
GEOPOLITICS_QUERY = "(china taiwan OR us china OR india OR modi OR brics OR quad)"


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    cleaned = " ".join(value.strip().split())
    return cleaned or None


def _extract_keyword(title: str | None) -> str:
    if not title:
        return "global news"

    words = title.split()
    if not words:
        return "global news"

    return " ".join(words[:5])


def _normalize_article(item: dict[str, Any]) -> dict[str, Any]:
    title = _clean_text(item.get("title"))
    description = _clean_text(item.get("description"))

    source_value = item.get("source_id") or item.get("source_name")
    source = _clean_text(source_value)
    bias = get_bias(source or "")

    return {
        "title": title,
        "description": description,
        "source": source,
        "bias": bias,
        "keyword": _extract_keyword(title),
    }


def _fetch_section(*, query: str | None = None, category: str | None = None) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "apikey": settings.newsdata_api_key,
        "language": "en",
        "size": SECTION_SIZE,
    }
    if query:
        params["q"] = query
    if category:
        params["category"] = category

    response = requests.get(
        f"{settings.newsdata_base_url}/latest",
        params=params,
        timeout=settings.newsdata_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()

    if payload.get("status") == "error":
        provider_detail = payload.get("results") or payload.get("message") or "News provider error."
        if isinstance(provider_detail, list):
            provider_detail = ", ".join(str(item) for item in provider_detail if item)
        raise ValueError(provider_detail)

    raw_results = payload.get("results")
    if not isinstance(raw_results, list):
        return []

    return [_normalize_article(item) for item in raw_results if isinstance(item, dict)][:SECTION_SIZE]


def _safe_fetch_section(*, query: str | None = None, category: str | None = None) -> list[dict[str, Any]]:
    try:
        return _fetch_section(query=query, category=category)
    except (requests.RequestException, ValueError):
        return []


def _build_trending_data() -> dict[str, list[dict[str, Any]]]:
    return {
        "general": _safe_fetch_section(category="top"),
        "war": _safe_fetch_section(query=WAR_QUERY, category="world,politics"),
        "geopolitics": _safe_fetch_section(query=GEOPOLITICS_QUERY),
    }


@router.get("/trending")
def get_trending() -> dict[str, list[dict[str, Any]]]:
    if not settings.newsdata_api_key or settings.newsdata_api_key == "your_key_here":
        raise HTTPException(
            status_code=500,
            detail="NEWSDATA_API_KEY is not configured on the server.",
        )

    now = datetime.now(timezone.utc)
    with CACHE_LOCK:
        cached_data = CACHE.get("data")
        last_updated = CACHE.get("last_updated")
        if isinstance(last_updated, datetime) and cached_data and now - last_updated < CACHE_TTL:
            return cached_data

    fresh_data = _build_trending_data()

    with CACHE_LOCK:
        CACHE["data"] = fresh_data
        CACHE["last_updated"] = now

    return fresh_data
