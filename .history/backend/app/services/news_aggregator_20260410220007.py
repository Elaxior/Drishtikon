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
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from difflib import SequenceMatcher
from threading import Lock
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.bias import get_bias
from app.core.config import settings

logger = logging.getLogger(__name__)

_PROVIDER_COOLDOWN_SECONDS = 15 * 60
_provider_cooldown_until: dict[str, float] = {}
_USAGE_LOCK = Lock()
_provider_key_usage: dict[str, dict[str, Any]] = {}

_PROVIDER_ORDER = ("newsdata", "gnews", "currents", "newsapi")
_PROVIDER_DISPLAY_NAMES = {
    "newsdata": "NewsData",
    "gnews": "GNews",
    "currents": "Currents",
    "newsapi": "NewsAPI",
}

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


def _is_provider_in_cooldown(provider_name: str) -> bool:
    until = _provider_cooldown_until.get(provider_name, 0.0)
    return time.time() < until


def _set_provider_cooldown(provider_name: str) -> None:
    _provider_cooldown_until[provider_name] = time.time() + _PROVIDER_COOLDOWN_SECONDS


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


def _today_utc_key() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _provider_configured_keys(provider_name: str) -> list[str]:
    if provider_name == "newsdata":
        return _api_keys(settings.newsdata_api_key)
    if provider_name == "gnews":
        return _api_keys(settings.gnews_api_key)
    if provider_name == "currents":
        return _api_keys(settings.currents_api_key)
    if provider_name == "newsapi":
        return _api_keys(settings.newsapi_api_key)
    return []


def _provider_daily_limit(provider_name: str) -> int | None:
    if provider_name == "newsdata":
        configured = settings.newsdata_daily_limit
    elif provider_name == "gnews":
        configured = settings.gnews_daily_limit
    elif provider_name == "currents":
        configured = settings.currents_daily_limit
    elif provider_name == "newsapi":
        configured = settings.newsapi_daily_limit
    else:
        configured = 0

    return configured if configured > 0 else None


def _record_provider_attempt(
    provider_name: str,
    key: str,
    *,
    success: bool,
    quota_related: bool = False,
) -> None:
    with _USAGE_LOCK:
        day_key = _today_utc_key()
        provider_entry = _provider_key_usage.get(provider_name)
        if not provider_entry or provider_entry.get("date") != day_key:
            provider_entry = {"date": day_key, "keys": {}}
            _provider_key_usage[provider_name] = provider_entry

        key_usage = provider_entry["keys"].setdefault(
            key,
            {
                "used_today": 0,
                "success_calls": 0,
                "failed_calls": 0,
                "quota_related_errors": 0,
            },
        )

        key_usage["used_today"] += 1
        if success:
            key_usage["success_calls"] += 1
        else:
            key_usage["failed_calls"] += 1
            if quota_related:
                key_usage["quota_related_errors"] += 1


def get_api_usage_stats() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    day_key = now.date().isoformat()

    with _USAGE_LOCK:
        usage_snapshot: dict[str, dict[str, Any]] = {}
        for provider_name in _PROVIDER_ORDER:
            provider_usage = _provider_key_usage.get(provider_name)
            if not provider_usage or provider_usage.get("date") != day_key:
                usage_snapshot[provider_name] = {}
                continue

            keys_usage = provider_usage.get("keys", {})
            usage_snapshot[provider_name] = {
                key: dict(stats) for key, stats in keys_usage.items() if isinstance(stats, dict)
            }

    providers: list[dict[str, Any]] = []
    for provider_name in _PROVIDER_ORDER:
        configured_keys = _provider_configured_keys(provider_name)
        per_key_limit = _provider_daily_limit(provider_name)
        provider_usage = usage_snapshot.get(provider_name, {})

        seen_keys: set[str] = set()
        key_stats: list[dict[str, Any]] = []

        for key in configured_keys:
            seen_keys.add(key)
            key_usage = provider_usage.get(key, {})
            used_today = int(key_usage.get("used_today", 0))
            key_limit = per_key_limit
            key_remaining = None if key_limit is None else max(0, key_limit - used_today)

            key_stats.append({
                "key_mask": _mask_key(key),
                "configured": True,
                "used_today": used_today,
                "remaining_today": key_remaining,
                "success_calls": int(key_usage.get("success_calls", 0)),
                "failed_calls": int(key_usage.get("failed_calls", 0)),
                "quota_related_errors": int(key_usage.get("quota_related_errors", 0)),
            })

        for key, key_usage in provider_usage.items():
            if key in seen_keys:
                continue
            used_today = int(key_usage.get("used_today", 0))
            key_stats.append({
                "key_mask": _mask_key(key),
                "configured": False,
                "used_today": used_today,
                "remaining_today": None,
                "success_calls": int(key_usage.get("success_calls", 0)),
                "failed_calls": int(key_usage.get("failed_calls", 0)),
                "quota_related_errors": int(key_usage.get("quota_related_errors", 0)),
            })

        used_total = sum(int(item.get("used_today", 0)) for item in key_stats)
        total_limit = None if per_key_limit is None else per_key_limit * len(configured_keys)
        remaining_total = None if total_limit is None else max(0, total_limit - used_total)
        usage_pct = None
        if total_limit and total_limit > 0:
            usage_pct = round((used_total / total_limit) * 100, 2)

        providers.append({
            "provider": provider_name,
            "display_name": _PROVIDER_DISPLAY_NAMES.get(provider_name, provider_name.title()),
            "configured": len(configured_keys) > 0,
            "keys_configured": len(configured_keys),
            "per_key_daily_limit": per_key_limit,
            "total_daily_limit": total_limit,
            "used_today": used_total,
            "remaining_today": remaining_total,
            "usage_percent": usage_pct,
            "key_stats": key_stats,
        })

    return {
        "date_utc": day_key,
        "generated_at": now.isoformat(),
        "providers": providers,
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
                timeout=settings.provider_timeout_seconds,
            )
            resp.raise_for_status()
            candidate_payload = resp.json()
            if candidate_payload.get("status") == "error":
                _record_provider_attempt("newsdata", key, success=False)
                logger.warning(
                    "NewsData returned error status with key %s",
                    _mask_key(key),
                )
                continue
            _record_provider_attempt("newsdata", key, success=True)
            payload = candidate_payload
            break
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            _record_provider_attempt(
                "newsdata",
                key,
                success=False,
                quota_related=status_code in {401, 403, 429},
            )
            logger.warning("NewsData fetch failed with key %s: %s", _mask_key(key), exc)
        except Exception as exc:
            _record_provider_attempt("newsdata", key, success=False)
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
    if _is_provider_in_cooldown("gnews"):
        return []

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
    auth_or_quota_failure = False
    for key in keys:
        params = dict(params_base)
        params["apikey"] = key
        try:
            resp = requests.get(
                f"https://gnews.io/api/v4/{endpoint}",
                params=params,
                timeout=settings.provider_timeout_seconds,
            )
            resp.raise_for_status()
            _record_provider_attempt("gnews", key, success=True)
            payload = resp.json()
            break
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            quota_related = status_code in {401, 403, 429}
            _record_provider_attempt(
                "gnews",
                key,
                success=False,
                quota_related=quota_related,
            )
            if status_code in {401, 403}:
                auth_or_quota_failure = True
                continue
            logger.warning("GNews fetch failed with key %s: %s", _mask_key(key), exc)
        except Exception as exc:
            _record_provider_attempt("gnews", key, success=False)
            logger.warning("GNews fetch failed with key %s: %s", _mask_key(key), exc)

    if payload is None and auth_or_quota_failure:
        _set_provider_cooldown("gnews")
        logger.warning("GNews temporarily disabled for 15 minutes due auth/quota errors.")

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
                timeout=settings.provider_timeout_seconds,
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
                timeout=settings.provider_timeout_seconds,
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
