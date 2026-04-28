"""
Multi-source news aggregator.

Fetches articles from multiple free news APIs concurrently, normalizes
them into a unified format, and deduplicates by title similarity.

Supported providers:
  - NewsData.io  (existing)
  - GNews.io     (100 req/day free)
  - Currents API (600 req/day free)
    - NewsAPI.org  (country-aware headlines)
"""

from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.bias import get_bias
from app.core.config import settings

logger = logging.getLogger(__name__)

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


def _api_keys(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    return [part.strip() for part in re.split(r"[,;\n]+", raw_value) if part.strip()]


def _mask_key(key: str) -> str:
    if len(key) <= 6:
        return "***"
    return f"{key[:3]}...{key[-3:]}"


def _sanitize_query(query: str | None) -> str | None:
    if not query:
        return None

    normalized = (
        query.replace("\u2018", " ")
        .replace("\u2019", " ")
        .replace("\u201c", " ")
        .replace("\u201d", " ")
    )
    normalized = re.sub(r"[`'\"\\/:;!?]+", " ", normalized)
    normalized = re.sub(r"[^\w\s-]", " ", normalized)
    normalized = " ".join(normalized.split()).strip("- ")
    return normalized or None


# ──────────────────────────────────────────────────────
#  Provider: NewsData.io
# ──────────────────────────────────────────────────────

def _fetch_newsdata(
    *,
    query: str | None = None,
    category: str | None = None,
    size: int = 10,
) -> list[NormalArticle]:
    keys = _api_keys(settings.newsdata_api_key)
    if not keys:
        return []

    clean_query = _sanitize_query(query)

    params_base: dict[str, Any] = {
        "language": "en",
        "size": min(size, 10),
    }
    if clean_query:
        params_base["q"] = clean_query
    if category:
        params_base["category"] = category

    payload: dict[str, Any] | None = None
    for key in keys:
        params = dict(params_base)
        params["apikey"] = key
        try:
            resp = requests.get(
                f"{settings.newsdata_base_url}/latest",
                params=params,
                timeout=settings.newsdata_timeout_seconds,
            )
            resp.raise_for_status()
            candidate_payload = resp.json()
            if candidate_payload.get("status") == "error":
                logger.warning(
                    "NewsData returned error status with key %s",
                    _mask_key(key),
                )
                continue
            payload = candidate_payload
            break
        except Exception as exc:
            logger.warning("NewsData fetch failed with key %s: %s", _mask_key(key), exc)

    if payload is None:
        return []

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
    keys = _api_keys(settings.gnews_api_key)
    if not keys:
        return []

    clean_query = _sanitize_query(query)

    endpoint = "search" if clean_query else "top-headlines"

    params_base: dict[str, Any] = {
        "lang": "en",
        "max": min(size, 10),
    }
    if clean_query:
        params_base["q"] = clean_query

    # GNews supports topic for top-headlines, not category for search.
    gnews_topic_map = {
        "top": "world",
        "world": "world",
        "politics": "nation",
        "world,politics": "world",
    }
    if endpoint == "top-headlines" and category:
        mapped = gnews_topic_map.get(category, "world")
        params_base["topic"] = mapped

    payload: dict[str, Any] | None = None
    for key in keys:
        params = dict(params_base)
        params["apikey"] = key
        try:
            resp = requests.get(
                f"https://gnews.io/api/v4/{endpoint}",
                params=params,
                timeout=12,
            )
            resp.raise_for_status()
            payload = resp.json()
            break
        except Exception as exc:
            logger.warning("GNews fetch failed with key %s: %s", _mask_key(key), exc)

    if payload is None:
        return []

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
    keys = _api_keys(settings.currents_api_key)
    if not keys:
        return []

    clean_query = _sanitize_query(query)

    params_base: dict[str, Any] = {
        "language": "en",
    }
    if clean_query:
        params_base["keywords"] = clean_query
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
        params_base["category"] = mapped

    endpoint = "search" if clean_query else "latest-news"

    payload: dict[str, Any] | None = None
    for key in keys:
        params = dict(params_base)
        params["apiKey"] = key
        try:
            resp = requests.get(
                f"https://api.currentsapi.services/v1/{endpoint}",
                params=params,
                timeout=12,
            )
            resp.raise_for_status()
            candidate_payload = resp.json()
            if candidate_payload.get("status") != "ok":
                logger.warning(
                    "Currents returned non-ok status with key %s",
                    _mask_key(key),
                )
                continue
            payload = candidate_payload
            break
        except Exception as exc:
            logger.warning("Currents fetch failed with key %s: %s", _mask_key(key), exc)

    if payload is None:
        return []

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
#  Provider: NewsAPI.org
# ──────────────────────────────────────────────────────

def _fetch_newsapi(
    *,
    query: str | None = None,
    category: str | None = None,
    size: int = 10,
) -> list[NormalArticle]:
    keys = _api_keys(settings.newsapi_api_key)
    if not keys:
        return []

    clean_query = _sanitize_query(query)
    endpoint = "everything" if clean_query else "top-headlines"

    params_base: dict[str, Any] = {
        "pageSize": min(size, 20),
    }
    if endpoint == "everything":
        params_base["q"] = clean_query
        params_base["language"] = "en"
        params_base["sortBy"] = "publishedAt"
    else:
        params_base["country"] = "in"
        newsapi_category_map = {
            "top": "general",
            "world": "general",
            "politics": "general",
            "world,politics": "general",
        }
        if category:
            params_base["category"] = newsapi_category_map.get(category, "general")

    payload: dict[str, Any] | None = None
    for key in keys:
        params = dict(params_base)
        params["apiKey"] = key
        try:
            resp = requests.get(
                f"https://newsapi.org/v2/{endpoint}",
                params=params,
                timeout=12,
            )
            resp.raise_for_status()
            candidate_payload = resp.json()
            if candidate_payload.get("status") != "ok":
                logger.warning(
                    "NewsAPI returned non-ok status with key %s",
                    _mask_key(key),
                )
                continue
            payload = candidate_payload
            break
        except Exception as exc:
            logger.warning("NewsAPI fetch failed with key %s: %s", _mask_key(key), exc)

    if payload is None:
        return []

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
        source_name = None
        if isinstance(source_info, dict):
            source_name = _clean(source_info.get("name") or source_info.get("id"))
        source_name = source_name or _extract_domain(link)

        articles.append({
            "title": title,
            "description": description,
            "source": source_name,
            "bias": get_bias(source_name or ""),
            "link": link,
            "pubDate": item.get("publishedAt"),
            "image_url": _clean_url(item.get("urlToImage")),
            "provider": "newsapi",
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
    results: list[NormalArticle] = []

    with ThreadPoolExecutor(max_workers=4) as executor:
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
            executor.submit(
                _fetch_newsapi,
                query=query,
                category=category,
                size=size_per_provider,
            ): "newsapi",
        }

        for future in as_completed(futures):
            provider = futures[future]
            try:
                articles = future.result()
                logger.info("Provider %s returned %d articles", provider, len(articles))
                results.extend(articles)
            except Exception as exc:
                logger.warning("Provider %s raised: %s", provider, exc)

    # Deduplicate
    results = _deduplicate(results)

    # Sort by pubDate descending (newest first), None dates go last
    def _sort_key(a: NormalArticle) -> str:
        return a.get("pubDate") or ""

    results.sort(key=_sort_key, reverse=True)

    return results


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

    with ThreadPoolExecutor(max_workers=4) as executor:
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
            executor.submit(
                _fetch_newsapi,
                query=query,
                category=category,
                size=size_per_provider,
            ): "newsapi",
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
