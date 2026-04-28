from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.services.news_aggregator import aggregate_trending

router = APIRouter(tags=["trending"])

CACHE: dict[str, Any] = {
    "data": None,
    "last_updated": None,
}
CACHE_TTL = timedelta(minutes=10)
CACHE_LOCK = Lock()
SECTION_SIZE = 8  # more items per section for variety

GENERAL_INDIA_QUERY = "(india OR delhi OR mumbai OR bengaluru OR parliament OR sensex OR rupee)"
WAR_QUERY = "(india pakistan OR kashmir OR china border OR ukraine OR gaza OR israel)"
GEOPOLITICS_QUERY = "(india china OR india us OR quad OR brics OR indo pacific OR south asia)"


def _extract_keyword(title: str | None) -> str:
    if not title:
        return "global news"


    words = title.split()
    if not words:
        return "global news"

    return " ".join(words[:5])


def _with_keyword(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add keyword field to each article for topic-pill navigation."""
    for a in articles:
        a["keyword"] = _extract_keyword(a.get("title"))
    return a and articles or articles


def _merge_unique_articles(primary: list[dict[str, Any]], extra: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    for article in [*primary, *extra]:
        link = article.get("link")
        title = article.get("title")
        key = (
            f"link:{link.strip()}"
            if isinstance(link, str) and link.strip()
            else f"title:{(title or '').strip().lower()}"
        )
        if key in seen:
            continue
        seen.add(key)
        merged.append(article)

    return merged


def _build_trending_data() -> dict[str, list[dict[str, Any]]]:
    india_general = aggregate_trending(query=GENERAL_INDIA_QUERY, size_per_provider=SECTION_SIZE)
    global_general = aggregate_trending(category="top", size_per_provider=SECTION_SIZE)
    general = _merge_unique_articles(india_general, global_general)
    war = aggregate_trending(query=WAR_QUERY, category="world,politics", size_per_provider=SECTION_SIZE)
    geopolitics = aggregate_trending(query=GEOPOLITICS_QUERY, size_per_provider=SECTION_SIZE)

    return {
        "general": _with_keyword(general[:SECTION_SIZE]),
        "war": _with_keyword(war[:SECTION_SIZE]),
        "geopolitics": _with_keyword(geopolitics[:SECTION_SIZE]),
    }


@router.get("/trending")
def get_trending() -> dict[str, list[dict[str, Any]]]:
    # Check that at least one news API key is configured
    has_provider = any([
        settings.newsdata_api_key and settings.newsdata_api_key != "your_key_here",
        settings.gnews_api_key,
        settings.currents_api_key,
        settings.newsapi_api_key,
    ])
    if not has_provider:
        raise HTTPException(
            status_code=500,
            detail="No news API keys are configured on the server.",
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
