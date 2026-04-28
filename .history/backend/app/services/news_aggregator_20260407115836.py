"""
Multi-source news aggregator.

Fetches articles from multiple free news APIs concurrently, normalizes
them into a unified format, and deduplicates by title similarity.

Supported providers:
  - NewsData.io  (existing)
  - GNews.io     (100 req/day free)
  - Currents API (600 req/day free)
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed, wait
from threading import Lock
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.bias import get_bias
from app.core.config import settings

logger = logging.getLogger(__name__)

PROVIDER_NAMES = ("newsdata", "gnews", "currents")
_PROVIDER_USAGE_LOCK = Lock()
_PROVIDER_USAGE: dict[str, dict[str, int]] = {
    name: {"attempts": 0, "successes": 0, "failures": 0}
    for name in PROVIDER_NAMES
}


class ProviderFetchError(Exception):
    """Represents a provider request/parsing failure."""

# ──────────────────────────────────────────────────────
#  Common types
# ──────────────────────────────────────────────────────

NormalArticle = dict[str, Any]
"""
Normalised article dict:
  title, description, source, bias, link, pubDate, image_url, provider
"""


def _clean(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.strip().split())
    return cleaned or None


def _clean_url(value: Any) -> str | None:
    url = _clean(value)
    if not url:
        return None
    if not (url.startswith("http://") or url.startswith("https://")):
        return None
    return url


def _extract_domain(url: Any) -> str | None:
    cleaned_url = _clean_url(url)
    if not cleaned_url:
        return None

    try:
        parsed = urlparse(cleaned_url)
    except Exception:
        return None

    host = (parsed.netloc or "").lower().replace("www.", "")
    return host or None


def _looks_english(text: str | None) -> bool:
    if not text:
        return True

    letters = re.findall(r"[A-Za-z\u00C0-\u024F]", text)
    if not letters:
        return True

    ascii_letters = re.findall(r"[A-Za-z]", text)
    return (len(ascii_letters) / len(letters)) >= 0.65


def _increment_provider_usage(provider: str, metric: str) -> None:
    if provider not in _PROVIDER_USAGE:
        return

    with _PROVIDER_USAGE_LOCK:
        _PROVIDER_USAGE[provider][metric] += 1


def get_provider_usage_stats() -> dict[str, dict[str, int]]:
    with _PROVIDER_USAGE_LOCK:
        return {
            provider: dict(metrics)
            for provider, metrics in _PROVIDER_USAGE.items()
        }


def _enabled_provider_map() -> dict[str, bool]:
    return {
        "newsdata": bool(settings.newsdata_api_key),
        "gnews": bool(settings.gnews_api_key),
        "currents": bool(settings.currents_api_key),
    }


# ──────────────────────────────────────────────────────
#  Provider: NewsData.io
# ──────────────────────────────────────────────────────

def _fetch_newsdata(
    *,
    query: str | None = None,
    category: str | None = None,
    size: int = 10,
) -> list[NormalArticle]:
    if not settings.newsdata_api_key:
        return []

    params: dict[str, Any] = {
        "apikey": settings.newsdata_api_key,
        "language": "en",
        "size": min(size, 10),
    }
    if query:
        params["q"] = query
    if category:
        params["category"] = category

    try:
        resp = requests.get(
            f"{settings.newsdata_base_url}/latest",
            params=params,
            timeout=settings.newsdata_timeout_seconds,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        raise ProviderFetchError(f"NewsData fetch failed: {exc}") from exc

    if payload.get("status") == "error":
        raise ProviderFetchError("NewsData API returned error status")

    raw = payload.get("results")
    if not isinstance(raw, list):
        return []

    articles: list[NormalArticle] = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        title = _clean(item.get("title"))
        description = _clean(item.get("description"))
        if not title:
            continue
        if not _looks_english(" ".join(part for part in [title, description] if part)):
            continue

        link = _clean_url(item.get("link"))
        source = _clean(item.get("source_id") or item.get("source_name")) or _extract_domain(link)

        articles.append({
            "title": title,
            "description": description,
            "source": source,
            "bias": get_bias(source or ""),
            "link": link,
            "pubDate": item.get("pubDate"),
            "image_url": _clean_url(item.get("image_url")),
            "provider": "newsdata",
        })
    return articles


# ──────────────────────────────────────────────────────
#  Provider: GNews.io
# ──────────────────────────────────────────────────────

def _fetch_gnews(
    *,
    query: str | None = None,
    category: str | None = None,
    size: int = 10,
) -> list[NormalArticle]:
    if not settings.gnews_api_key:
        return []

    endpoint = "search" if query else "top-headlines"

    params: dict[str, Any] = {
        "apikey": settings.gnews_api_key,
        "lang": "en",
        "max": min(size, 10),
    }
    if query:
        params["q"] = query

    # GNews supports topic for top-headlines, not category for search.
    gnews_topic_map = {
        "top": "world",
        "world": "world",
        "politics": "nation",
        "world,politics": "world",
    }
    if endpoint == "top-headlines" and category:
        mapped = gnews_topic_map.get(category, "world")
        params["topic"] = mapped

    try:
        resp = requests.get(
            f"https://gnews.io/api/v4/{endpoint}",
            params=params,
            timeout=12,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        raise ProviderFetchError(f"GNews fetch failed: {exc}") from exc

    raw = payload.get("articles")
    if not isinstance(raw, list):
        return []

    articles: list[NormalArticle] = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        title = _clean(item.get("title"))
        description = _clean(item.get("description"))
        if not title:
            continue
        if not _looks_english(" ".join(part for part in [title, description] if part)):
            continue

        link = _clean_url(item.get("url"))
        source_info = item.get("source") or {}
        source_name = _clean(source_info.get("name") if isinstance(source_info, dict) else None)
        source_name = source_name or _extract_domain(link)

        articles.append({
            "title": title,
            "description": description,
            "source": source_name,
            "bias": get_bias(source_name or ""),
            "link": link,
            "pubDate": item.get("publishedAt"),
            "image_url": _clean_url(item.get("image")),
            "provider": "gnews",
        })
    return articles


# ──────────────────────────────────────────────────────
#  Provider: Currents API
# ──────────────────────────────────────────────────────

def _fetch_currents(
    *,
    query: str | None = None,
    category: str | None = None,
    size: int = 10,
) -> list[NormalArticle]:
    if not settings.currents_api_key:
        return []

    params: dict[str, Any] = {
        "apiKey": settings.currents_api_key,
        "language": "en",
    }
    if query:
        params["keywords"] = query
    if category:
        # Currents categories: regional, technology, lifestyle, business,
        # general, programming, science, entertainment, world, sports, etc.
        currents_category_map = {
            "top": "general",
            "world": "world",
            "politics": "world",
            "world,politics": "world",
        }
        mapped = currents_category_map.get(category, "general")
        params["category"] = mapped

    endpoint = "search" if query else "latest-news"

    try:
        resp = requests.get(
            f"https://api.currentsapi.services/v1/{endpoint}",
            params=params,
            timeout=12,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        raise ProviderFetchError(f"Currents fetch failed: {exc}") from exc

    if payload.get("status") != "ok":
        raise ProviderFetchError("Currents API returned non-ok status")

    raw = payload.get("news")
    if not isinstance(raw, list):
        return []

    articles: list[NormalArticle] = []
    for item in raw[:size]:
        if not isinstance(item, dict):
            continue

        title = _clean(item.get("title"))
        description = _clean(item.get("description"))
        if not title:
            continue
        if not _looks_english(" ".join(part for part in [title, description] if part)):
            continue

        link = _clean_url(item.get("url"))

        # Domain is more stable than author for source bias mapping.
        source_name = _extract_domain(link) or _clean(item.get("author"))

        articles.append({
            "title": title,
            "description": description,
            "source": source_name,
            "bias": get_bias(source_name or ""),
            "link": link,
            "pubDate": item.get("published"),
            "image_url": _clean_url(item.get("image") if item.get("image") != "None" else None),
            "provider": "currents",
        })
    return articles


# ──────────────────────────────────────────────────────
#  Deduplication
# ──────────────────────────────────────────────────────

def _title_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _normalized_token(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _deduplicate(articles: list[NormalArticle], threshold: float = 0.92) -> list[NormalArticle]:
    """
    Remove true duplicates while preserving same-story coverage from
    different outlets (important for left/center/right comparison).
    """
    unique: list[NormalArticle] = []

    for article in articles:
        title = article.get("title")
        if not title:
            continue

        link = _clean_url(article.get("link"))
        source = _normalized_token(article.get("source"))
        provider = _normalized_token(article.get("provider"))

        is_dup = False
        for existing in unique:
            existing_title = existing.get("title")
            if not existing_title:
                continue

            existing_link = _clean_url(existing.get("link"))
            existing_source = _normalized_token(existing.get("source"))
            existing_provider = _normalized_token(existing.get("provider"))

            # Identical canonical links are duplicates.
            if link and existing_link and link == existing_link:
                is_dup = True
                break

            similarity = _title_similarity(title, existing_title)

            # Same outlet and very similar title is a duplicate.
            if source and existing_source and source == existing_source and similarity >= 0.85:
                is_dup = True
                break

            # Within same provider, near-identical titles are usually repeats.
            if provider and existing_provider and provider == existing_provider and similarity >= threshold:
                is_dup = True
                break

        if not is_dup:
            unique.append(article)

    return unique


# ──────────────────────────────────────────────────────
#  Public API
# ──────────────────────────────────────────────────────

def aggregate_search(
    query: str,
    *,
    category: str | None = "world,politics",
    size_per_provider: int = 10,
) -> list[NormalArticle]:
    """
    Fetch news from all configured providers concurrently, merge and
    deduplicate.  Returns a unified list sorted by freshness.
    """
    payload = aggregate_search_with_meta(
        query,
        category=category,
        size_per_provider=size_per_provider,
    )
    return payload["articles"]


def aggregate_search_with_meta(
    query: str,
    *,
    category: str | None = "world,politics",
    size_per_provider: int = 10,
    overall_timeout_seconds: int = 10,
) -> dict[str, Any]:
    results: list[NormalArticle] = []
    enabled_map = _enabled_provider_map()
    provider_status: dict[str, dict[str, Any]] = {
        provider: {
            "state": "disabled" if not enabled_map[provider] else "pending",
            "article_count": 0,
            "error": None,
        }
        for provider in PROVIDER_NAMES
    }

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures: dict[Any, str] = {}

        if enabled_map["newsdata"]:
            _increment_provider_usage("newsdata", "attempts")
            futures[
                executor.submit(
                    _fetch_newsdata,
                    query=query,
                    category=category,
                    size=size_per_provider,
                )
            ] = "newsdata"

        if enabled_map["gnews"]:
            _increment_provider_usage("gnews", "attempts")
            futures[
                executor.submit(
                    _fetch_gnews,
                    query=query,
                    category=category,
                    size=size_per_provider,
                )
            ] = "gnews"

        if enabled_map["currents"]:
            _increment_provider_usage("currents", "attempts")
            futures[
                executor.submit(
                    _fetch_currents,
                    query=query,
                    category=category,
                    size=size_per_provider,
                )
            ] = "currents"

        done, not_done = wait(
            set(futures.keys()),
            timeout=max(1, overall_timeout_seconds),
        )

        for future in done:
            provider = futures[future]
            try:
                articles = future.result()
                provider_status[provider]["state"] = "ok"
                provider_status[provider]["article_count"] = len(articles)
                _increment_provider_usage(provider, "successes")
                logger.info("Provider %s returned %d articles", provider, len(articles))
                results.extend(articles)
            except Exception as exc:
                provider_status[provider]["state"] = "error"
                provider_status[provider]["error"] = str(exc)
                _increment_provider_usage(provider, "failures")
                logger.warning("Provider %s raised: %s", provider, exc)

        for future in not_done:
            provider = futures[future]
            future.cancel()
            provider_status[provider]["state"] = "timeout"
            provider_status[provider]["error"] = (
                f"Timed out after {max(1, overall_timeout_seconds)}s"
            )
            _increment_provider_usage(provider, "failures")
            logger.warning("Provider %s timed out", provider)

    # Deduplicate
    results = _deduplicate(results)

    # Sort by pubDate descending (newest first), None dates go last
    def _sort_key(a: NormalArticle) -> str:
        return a.get("pubDate") or ""

    results.sort(key=_sort_key, reverse=True)

    enabled_count = sum(1 for provider in PROVIDER_NAMES if enabled_map[provider])
    healthy_count = sum(
        1
        for provider in PROVIDER_NAMES
        if provider_status[provider]["state"] == "ok"
    )

    return {
        "articles": results,
        "provider_status": provider_status,
        "provider_summary": {
            "enabled": enabled_count,
            "healthy": healthy_count,
            "partial": healthy_count < enabled_count,
            "text": f"partial ({healthy_count}/{enabled_count} providers)"
            if healthy_count < enabled_count
            else f"full ({healthy_count}/{enabled_count} providers)",
        },
        "usage": get_provider_usage_stats(),
    }


def aggregate_trending(
    *,
    query: str | None = None,
    category: str | None = None,
    size_per_provider: int = 5,
) -> list[NormalArticle]:
    """
    Fetch trending/top articles from all providers concurrently.
    Used for the trending sections.
    """
    results: list[NormalArticle] = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(
                _fetch_newsdata,
                query=query,
                category=category,
                size=size_per_provider,
            ): "newsdata",
            executor.submit(
                _fetch_gnews,
                query=query,
                category=category,
                size=size_per_provider,
            ): "gnews",
            executor.submit(
                _fetch_currents,
                query=query,
                category=category,
                size=size_per_provider,
            ): "currents",
        }

        for future in as_completed(futures):
            provider = futures[future]
            try:
                articles = future.result()
                results.extend(articles)
            except Exception as exc:
                logger.warning("Trending provider %s raised: %s", provider, exc)

    results = _deduplicate(results)
    results.sort(key=lambda a: a.get("pubDate") or "", reverse=True)
    return results
