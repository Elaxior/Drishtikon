from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from datetime import datetime, timedelta, timezone
import logging
import re
from threading import Lock
from time import perf_counter
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query
import requests

from app.core.config import settings
from app.services.claim_extractor import extract_claims
from app.services.consensus import calculate_consensus, group_claims
from app.services.news_aggregator import aggregate_search
from app.services.social_claim_extractor import (
    detect_social_media_platform,
    extract_claim_from_social_media,
)
from app.services.summarizer import SUMMARY_FALLBACK, generate_summary
from app.services.verifier import summarize_verification, verify_claim_group
from app.services.vector_store import pinecone_status, summarize_historical_matches, upsert_claims

router = APIRouter(tags=["search"])
logger = logging.getLogger(__name__)

_CACHE_LOCK = Lock()
_SEARCH_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}

BIAS_BUCKETS = ("LEFT", "CENTER", "RIGHT")
QUERY_STOPWORDS = {
    "the",
    "and",
    "are",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "your",
    "you",
    "our",
    "their",
    "they",
    "were",
    "have",
    "has",
    "had",
    "not",
    "need",
}
INDIA_SOURCE_HINTS = (
    "thehindu",
    "timesofindia",
    "indiatoday",
    "indianexpress",
    "hindustantimes",
    "ndtv",
    "wion",
    "republic",
    "zeenews",
    "moneycontrol",
    "businessstandard",
    "economictimes",
    "mint",
    "firstpost",
    "deccanherald",
    "theprint",
    "thewire",
    "scroll",
    "news18",
)
URL_PATTERN = re.compile(r"https?://[^\s<>()\[\]{}\"']+", re.IGNORECASE)


def _cache_key(query: str, effective_query: str) -> str:
    return "|".join(
        [
            query.strip().lower(),
            effective_query.strip().lower(),
            str(settings.analysis_article_limit),
            str(settings.search_size_per_provider),
            str(settings.claims_article_limit),
            str(settings.require_full_spectrum),
            str(settings.consensus_similarity_threshold),
            str(settings.enable_verifier),
            str(settings.verification_claim_limit),
            str(settings.verification_similarity_threshold),
            str(settings.search_latency_budget_seconds),
            str(settings.search_max_query_variants),
            str(settings.provider_timeout_seconds),
        ]
    )


def _get_cached_response(cache_key: str) -> dict[str, Any] | None:
    if not settings.enable_search_cache or settings.search_cache_ttl_seconds <= 0:
        return None

    with _CACHE_LOCK:
        cached = _SEARCH_CACHE.get(cache_key)
        if cached is None:
            return None

        expires_at, payload = cached
        if datetime.now(timezone.utc) > expires_at:
            _SEARCH_CACHE.pop(cache_key, None)
            return None

        return payload


def _set_cached_response(cache_key: str, payload: dict[str, Any]) -> None:
    if not settings.enable_search_cache or settings.search_cache_ttl_seconds <= 0:
        return

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.search_cache_ttl_seconds)
    with _CACHE_LOCK:
        _SEARCH_CACHE[cache_key] = (expires_at, payload)


def _remaining_budget_seconds(started_at: float) -> float:
    elapsed = perf_counter() - started_at
    return max(0.0, settings.search_latency_budget_seconds - elapsed)


def _quick_summary(articles: list[dict[str, Any]]) -> str:
    if not articles:
        return "No sources were retrieved in time."

    lines: list[str] = []
    for article in articles[:3]:
        source = article.get("source") if isinstance(article.get("source"), str) else None
        title = article.get("title") if isinstance(article.get("title"), str) else None
        if not source and not title:
            continue
        lines.append(f"{source or 'Unknown'}: {title or 'Untitled'}")

    if not lines:
        return SUMMARY_FALLBACK

    joined = " | ".join(lines)
    return f"Fast summary: {joined}"


def _is_india_source(article: dict[str, Any]) -> bool:
    source = article.get("source")
    source_normalized = re.sub(r"[^a-z0-9]+", "", source.lower()) if isinstance(source, str) else ""
    if source_normalized:
        if any(hint in source_normalized for hint in INDIA_SOURCE_HINTS):
            return True
        if source_normalized.endswith("in"):
            return True

    link = article.get("link")
    if isinstance(link, str) and link.strip():
        try:
            host = urlparse(link).netloc.lower().replace("www.", "")
        except Exception:
            host = ""

        if host.endswith(".in"):
            return True
        host_normalized = re.sub(r"[^a-z0-9]+", "", host)
        if host_normalized and any(hint in host_normalized for hint in INDIA_SOURCE_HINTS):
            return True

    return False


def _article_quality_key(article: dict[str, Any]) -> tuple[int, int, int, int, int]:
    image_url = article.get("image_url")
    has_image = isinstance(image_url, str) and bool(image_url.strip())

    link = article.get("link")
    has_link = isinstance(link, str) and bool(link.strip())

    source = article.get("source")
    has_source = isinstance(source, str) and source.strip().lower() not in {"", "unknown"}

    bias = article.get("bias", "UNKNOWN")
    known_bias = bias in {"LEFT", "CENTER", "RIGHT"}
    india_source = _is_india_source(article)

    return (
        int(has_image),
        int(known_bias),
        int(india_source),
        int(has_source),
        int(has_link),
    )


def _article_identity_key(article: dict[str, Any]) -> str:
    link = article.get("link")
    if isinstance(link, str) and link.strip():
        return f"link:{link.strip()}"

    source = article.get("source")
    title = article.get("title")
    source_key = source.strip().lower() if isinstance(source, str) and source.strip() else "unknown"
    title_key = title.strip().lower() if isinstance(title, str) and title.strip() else "untitled"
    return f"source_title:{source_key}:{title_key}"


def _merge_unique_articles(primary: list[dict[str, Any]], extra: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    for article in [*primary, *extra]:
        key = _article_identity_key(article)
        if key in seen:
            continue
        seen.add(key)
        merged.append(article)

    return merged


def _has_enough_articles(articles: list[dict[str, Any]], target_count: int) -> bool:
    return len(articles) >= max(3, target_count)


def _bias_counts(articles: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"LEFT": 0, "CENTER": 0, "RIGHT": 0, "UNKNOWN": 0}
    for article in articles:
        bias = article.get("bias", "UNKNOWN")
        counts[bias if bias in counts else "UNKNOWN"] += 1
    return counts


def _has_full_spectrum(articles: list[dict[str, Any]]) -> bool:
    counts = _bias_counts(articles)
    return all(counts[bias] > 0 for bias in BIAS_BUCKETS)


def _query_variants(query: str) -> list[str]:
    variants: list[str] = []
    seen: set[str] = set()

    def add(candidate: str) -> None:
        normalized = " ".join(candidate.split()).strip()
        if not normalized:
            return
        key = normalized.lower()
        if key in seen:
            return
        seen.add(key)
        variants.append(normalized)

    normalized_query = (
        query.replace("\u2018", " ")
        .replace("\u2019", " ")
        .replace("\u201c", " ")
        .replace("\u201d", " ")
    )
    add(normalized_query)

    if "india" not in normalized_query.lower():
        add(f"{normalized_query} India")

    without_punct = re.sub(r"[^\w\s]", " ", query)
    add(without_punct)

    words = [word for word in re.sub(r"[^\w\s]", " ", query).split() if len(word) > 2]
    keywords = [word for word in words if word.lower() not in QUERY_STOPWORDS]

    if len(keywords) > 1:
        add(" ".join(keywords[:5]))

    if len(words) > 5:
        add(" ".join(words[:5]))

    if len(words) > 3:
        add(" ".join(words[:3]))

    return variants


def _clean_social_query_text(value: str) -> str:
    cleaned = re.sub(r"https?://\S+", " ", value or "")
    cleaned = re.sub(r"[^\w\s-]", " ", cleaned)
    cleaned = " ".join(cleaned.split()).strip()
    if not cleaned:
        return ""
    return " ".join(cleaned.split()[:24])


def _extract_first_url(value: str) -> str | None:
    match = URL_PATTERN.search(value or "")
    if not match:
        return None
    return match.group(0).rstrip(".,;:!?)\"")


def _social_timeout_fallback_queries(raw_query: str, platform: str | None) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()

    def add(candidate: str) -> None:
        normalized = _clean_social_query_text(candidate)
        if not normalized:
            return
        key = normalized.lower()
        if key in seen:
            return
        seen.add(key)
        candidates.append(normalized[:220])

    social_url = _extract_first_url(raw_query)
    platform_name = (platform or "social").strip()

    # Fast metadata fallback for YouTube links.
    if social_url and ("youtube.com" in social_url.lower() or "youtu.be" in social_url.lower()):
        try:
            response = requests.get(
                "https://www.youtube.com/oembed",
                params={"url": social_url, "format": "json"},
                timeout=1.8,
            )
            response.raise_for_status()
            payload = response.json() if response.text else {}
            if isinstance(payload, dict):
                title = payload.get("title")
                if isinstance(title, str):
                    add(title)
                    add(f"{title} news")
        except Exception:
            pass

    add(raw_query)
    add(f"{platform_name} breaking news")
    add("latest breaking news")

    return candidates[:6]


def _ensure_india_source_presence(
    selected: list[dict[str, Any]],
    raw_articles: list[dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:
    if any(_is_india_source(article) for article in selected):
        return selected

    india_candidates = [
        article
        for article in sorted(raw_articles, key=_article_quality_key, reverse=True)
        if _is_india_source(article)
    ]
    if not india_candidates:
        return selected

    selected_ids = {id(article) for article in selected}
    india_article = next((a for a in india_candidates if id(a) not in selected_ids), None)
    if india_article is None:
        return selected

    if len(selected) < limit:
        return [*selected, india_article]

    counts = _bias_counts(selected)
    ranked_indexes = sorted(range(len(selected)), key=lambda index: _article_quality_key(selected[index]))
    for index in ranked_indexes:
        existing = selected[index]
        existing_bias = existing.get("bias", "UNKNOWN")
        if existing_bias == "UNKNOWN" or counts.get(existing_bias, 0) > 1:
            updated = list(selected)
            updated[index] = india_article
            return updated

    return selected


def _select_balanced_articles(raw_articles: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    if limit <= 0:
        return []

    grouped: dict[str, list[dict[str, Any]]] = {
        "LEFT": [],
        "CENTER": [],
        "RIGHT": [],
        "UNKNOWN": [],
    }
    for article in raw_articles:
        bias = article.get("bias", "UNKNOWN")
        grouped[bias if bias in grouped else "UNKNOWN"].append(article)

    for bias in grouped:
        grouped[bias] = sorted(grouped[bias], key=_article_quality_key, reverse=True)

    selected: list[dict[str, Any]] = []

    # Seed one high-quality item per known bias when available.
    for bias in BIAS_BUCKETS:
        if len(selected) >= limit:
            break
        if grouped[bias]:
            selected.append(grouped[bias].pop(0))

    # Add additional known-bias items while keeping distribution balanced.
    while len(selected) < limit:
        available = [bias for bias in BIAS_BUCKETS if grouped[bias]]
        if not available:
            break

        current_counts = _bias_counts(selected)
        next_bias = min(
            available,
            key=lambda bias: (current_counts[bias], -len(grouped[bias])),
        )
        selected.append(grouped[next_bias].pop(0))

    # Fill remaining slots with unknown-bias sources only if needed.
    if len(selected) < limit and grouped["UNKNOWN"]:
        selected.extend(grouped["UNKNOWN"][: max(0, limit - len(selected))])

    return _ensure_india_source_presence(selected, raw_articles, limit)


@router.get("/search")
def search_news(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query parameter 'q' cannot be empty.")

    started_at = perf_counter()
    degraded_steps: list[str] = []

    platform, is_social_media_claim = detect_social_media_platform(query)
    social_media_data: dict[str, Any] | None = None
    effective_query = query
    social_fallback_queries: list[str] = []

    if is_social_media_claim:
        social_executor = ThreadPoolExecutor(max_workers=1)
        social_future = social_executor.submit(extract_claim_from_social_media, query, platform)
        try:
            social_media_data = social_future.result(timeout=settings.social_extraction_timeout_seconds)
        except FuturesTimeoutError:
            degraded_steps.append("social_extraction_timeout")
            social_future.cancel()
            timeout_fallback_queries = _social_timeout_fallback_queries(query, platform)
            timeout_fallback_query = timeout_fallback_queries[0] if timeout_fallback_queries else query
            social_media_data = {
                "original_input": query,
                "platform": platform,
                "is_social_media": True,
                "success": False,
                "extracted_claim": timeout_fallback_query,
                "derived_search_query": timeout_fallback_query,
                "fallback_search_queries": timeout_fallback_queries,
                "error": "Social extraction timed out. Falling back to metadata-derived search query.",
            }
        except Exception:
            degraded_steps.append("social_extraction_failed")
            failed_fallback_queries = _social_timeout_fallback_queries(query, platform)
            failed_fallback_query = failed_fallback_queries[0] if failed_fallback_queries else query
            social_media_data = {
                "original_input": query,
                "platform": platform,
                "is_social_media": True,
                "success": False,
                "extracted_claim": failed_fallback_query,
                "derived_search_query": failed_fallback_query,
                "fallback_search_queries": failed_fallback_queries,
                "error": "Social extraction failed. Falling back to metadata-derived search query.",
            }
        finally:
            social_executor.shutdown(wait=False, cancel_futures=True)

        derived_search_query = social_media_data.get("derived_search_query") if social_media_data else None
        fallback_candidates = social_media_data.get("fallback_search_queries") if social_media_data else None
        if isinstance(fallback_candidates, list):
            social_fallback_queries = [
                candidate.strip()
                for candidate in fallback_candidates
                if isinstance(candidate, str) and candidate.strip()
            ]

        extracted_claim = social_media_data.get("extracted_claim") if social_media_data else None
        if isinstance(derived_search_query, str) and derived_search_query.strip():
            effective_query = derived_search_query.strip()
        elif isinstance(extracted_claim, str) and extracted_claim.strip():
            normalized_claim = extracted_claim.strip()
            if not normalized_claim.lower().startswith("no verifiable factual claim"):
                effective_query = normalized_claim

    article_limit = max(3, settings.analysis_article_limit)

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

    cache_key = _cache_key(query, effective_query)
    cached_response = _get_cached_response(cache_key)
    if cached_response is not None:
        return cached_response

    # Fetch from all configured providers concurrently
    raw_articles: list[dict[str, Any]] = []

    variant_limit = max(1, settings.search_max_query_variants)
    if is_social_media_claim:
        variant_limit = max(5, variant_limit)

    ordered_candidates: list[str] = []
    if is_social_media_claim:
        ordered_candidates.extend([effective_query, *social_fallback_queries])
    ordered_candidates.extend(_query_variants(effective_query))

    candidate_queries: list[str] = []
    seen_candidates: set[str] = set()
    for candidate in ordered_candidates:
        normalized = candidate.strip()
        if not normalized:
            continue

        # Avoid URL-like queries for provider search, they rarely return matches.
        lowered = normalized.lower()
        if lowered.startswith("http") or "youtube.com/watch" in lowered or "youtu.be/" in lowered:
            continue

        key = lowered
        if key in seen_candidates:
            continue
        seen_candidates.add(key)
        candidate_queries.append(normalized)
        if len(candidate_queries) >= variant_limit:
            break

    if not candidate_queries:
        fallback = effective_query.strip() or query
        candidate_queries = [fallback]
    for variant_index, candidate_query in enumerate(candidate_queries):
        if _remaining_budget_seconds(started_at) < 2.4:
            degraded_steps.append("query_variants_budget_exhausted")
            break

        size_for_variant = settings.search_size_per_provider
        if variant_index > 0:
            size_for_variant = max(5, settings.search_size_per_provider - 4)

        candidate_articles = aggregate_search(
            candidate_query,
            category=None,
            size_per_provider=size_for_variant,
        )
        raw_articles = _merge_unique_articles(raw_articles, candidate_articles)
        if _has_enough_articles(raw_articles, article_limit * 2):
            break

    if not raw_articles:
        elapsed_ms = round((perf_counter() - started_at) * 1000, 1)
        return {
            "query": query,
            "effective_query": effective_query,
            "is_social_media_claim": is_social_media_claim,
            "social_media_data": social_media_data,
            "articles": [],
            "summary": "No sources were returned in time. Please retry this topic.",
            "claim_groups": [],
            "consensus": 0.0,
            "verification": {
                "label": settings.verification_label,
                "overall_verdict": "UNCERTAIN",
                "confidence": 0,
                "consensus_score": 0,
                "verified_claims": 0,
                "distribution": {
                    "supported": 0,
                    "contradicted": 0,
                    "mixed": 0,
                    "uncertain": 0,
                },
                "total_claim_groups": 0,
                "skipped_claim_groups": 0,
            },
            "pinecone": pinecone_status(),
            "total_sources": 0,
            "providers": {},
            "warning": "No providers returned results inside the latency budget.",
            "coverage": {
                "left": 0,
                "center": 0,
                "right": 0,
                "unknown": 0,
                "tracked_total": 0,
                "has_full_spectrum": False,
                "fallback_used": True,
                "distribution": {
                    "left_pct": 0,
                    "center_pct": 0,
                    "right_pct": 0,
                },
            },
            "performance": {
                "elapsed_ms": elapsed_ms,
                "budget_seconds": settings.search_latency_budget_seconds,
                "degraded_steps": [*degraded_steps, "providers_empty"],
            },
        }

    article_pool = raw_articles
    selected_articles = _select_balanced_articles(article_pool, article_limit)
    fallback_used = False
    coverage_warning: str | None = None

    # Retry once with a broader category set if one bias side is missing.
    if not _has_full_spectrum(selected_articles) and _remaining_budget_seconds(started_at) >= 1.8:
        supplemental_articles = aggregate_search(
            effective_query,
            category=None,
            size_per_provider=max(settings.search_size_per_provider, 10),
        )
        article_pool = _merge_unique_articles(raw_articles, supplemental_articles)
        selected_articles = _select_balanced_articles(article_pool, article_limit)
    elif not _has_full_spectrum(selected_articles):
        degraded_steps.append("supplemental_fetch_skipped_for_latency")

    if settings.require_full_spectrum and not _has_full_spectrum(selected_articles):
        fallback_used = True
        coverage_warning = (
            "Partial coverage fallback used: not enough LEFT/CENTER/RIGHT sources "
            "for this query right now."
        )
        logger.info("Using partial coverage fallback for query: %s", query)

    articles = [
        {
            "title": item.get("title"),
            "description": item.get("description"),
            "source": item.get("source"),
            "bias": item.get("bias", "UNKNOWN"),
            "claims": [],
            "link": item.get("link"),
            "pubDate": item.get("pubDate"),
            "image_url": item.get("image_url"),
            "provider": item.get("provider"),
        }
        for item in selected_articles
    ]

    claim_target_count = min(len(selected_articles), settings.claims_article_limit)
    if claim_target_count > 0 and _remaining_budget_seconds(started_at) >= 1.8:
        extraction_deadline = perf_counter() + min(
            settings.claim_extraction_timeout_seconds,
            max(1.0, _remaining_budget_seconds(started_at) - 0.9),
        )
        executor = ThreadPoolExecutor(max_workers=settings.claim_extraction_workers)
        futures_by_index: dict[int, Any] = {}
        try:
            for index in range(claim_target_count):
                item = selected_articles[index]
                title = item.get("title")
                description = item.get("description")
                article_text = "\n".join(part for part in [title or "", description or ""] if part).strip()
                if not article_text:
                    continue
                futures_by_index[index] = executor.submit(extract_claims, article_text)

            for index, future in futures_by_index.items():
                remaining = extraction_deadline - perf_counter()
                if remaining <= 0:
                    degraded_steps.append("claim_extraction_budget_exhausted")
                    break
                try:
                    claims = future.result(timeout=remaining)
                except FuturesTimeoutError:
                    degraded_steps.append("claim_extraction_timeout")
                    claims = []
                except Exception:
                    degraded_steps.append("claim_extraction_failed")
                    claims = []

                if isinstance(claims, list):
                    articles[index]["claims"] = claims
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
    elif claim_target_count > 0:
        degraded_steps.append("claim_extraction_skipped_for_latency")

    all_claims: list[dict[str, str]] = []
    for article in articles:
        source_value = article.get("source")
        source = source_value if isinstance(source_value, str) and source_value.strip() else "Unknown"

        claims_value = article.get("claims")
        if not isinstance(claims_value, list):
            continue

        for claim in claims_value[: settings.consensus_claims_per_article]:
            if not isinstance(claim, str):
                continue

            normalized_claim = claim.strip()
            if not normalized_claim:
                continue

            all_claims.append({"source": source, "claim": normalized_claim})

    summary = _quick_summary(articles)
    if _remaining_budget_seconds(started_at) >= 0.9:
        summary_executor = ThreadPoolExecutor(max_workers=1)
        summary_future = summary_executor.submit(generate_summary, articles)
        try:
            summary_timeout = min(
                settings.summary_timeout_seconds,
                max(0.5, _remaining_budget_seconds(started_at) - 0.35),
            )
            summary_candidate = summary_future.result(timeout=summary_timeout)
            if isinstance(summary_candidate, str) and summary_candidate.strip():
                summary = summary_candidate.strip()
        except FuturesTimeoutError:
            degraded_steps.append("summary_timeout")
            summary_future.cancel()
        except Exception:
            degraded_steps.append("summary_failed")
        finally:
            summary_executor.shutdown(wait=False, cancel_futures=True)
    else:
        degraded_steps.append("summary_skipped_for_latency")

    claim_groups = group_claims(all_claims)
    verification: dict[str, Any] | None = None

    if settings.enable_verifier and claim_groups and _remaining_budget_seconds(started_at) >= 0.9:
        verification_limit = max(1, settings.verification_claim_limit)
        enriched_groups: list[dict[str, Any]] = []

        for index, group in enumerate(claim_groups):
            enriched_group = dict(group)
            if index < verification_limit and _remaining_budget_seconds(started_at) >= 0.35:
                verification_payload = verify_claim_group(
                    str(enriched_group.get("representative_claim") or ""),
                    articles,
                )
            elif index < verification_limit:
                degraded_steps.append("verification_budget_exhausted")
                verification_payload = {
                    "verdict": "UNCERTAIN",
                    "confidence": 0,
                    "evidence": [],
                    "reason": "verification_budget_exhausted",
                    "verified_at": None,
                }
            else:
                verification_payload = {
                    "verdict": "UNCERTAIN",
                    "confidence": 0,
                    "evidence": [],
                    "reason": "out_of_verification_scope",
                    "verified_at": None,
                }

            enriched_group.update(verification_payload)
            enriched_groups.append(enriched_group)

        claim_groups = enriched_groups
        verified_subset = claim_groups[:verification_limit]
        verification = summarize_verification(verified_subset)
        verification["total_claim_groups"] = len(claim_groups)
        verification["skipped_claim_groups"] = max(0, len(claim_groups) - len(verified_subset))
        consensus = float(verification.get("consensus_score", 0.0))
    else:
        if settings.enable_verifier and claim_groups:
            degraded_steps.append("verification_skipped_for_latency")
        consensus = calculate_consensus(claim_groups)

    if verification is None:
        verification = {
            "label": settings.verification_label,
            "overall_verdict": "UNCERTAIN",
            "confidence": int(round(consensus)),
            "consensus_score": float(consensus),
            "verified_claims": 0,
            "distribution": {
                "supported": 0,
                "contradicted": 0,
                "mixed": 0,
                "uncertain": len(claim_groups),
            },
            "total_claim_groups": len(claim_groups),
            "skipped_claim_groups": len(claim_groups),
        }

    pinecone_info = pinecone_status()
    if pinecone_info.get("enabled") and _remaining_budget_seconds(started_at) >= 0.75:
        historical_matches = summarize_historical_matches(all_claims)
        if historical_matches:
            pinecone_info.update(historical_matches)
        indexed_claims = upsert_claims(all_claims, effective_query, articles)
        pinecone_info["indexed_claims"] = indexed_claims
    elif pinecone_info.get("enabled"):
        pinecone_info["skipped_for_latency"] = True
        degraded_steps.append("pinecone_skipped_for_latency")

    # Count articles per provider for metadata
    provider_counts: dict[str, int] = {}
    for a in articles:
        p = a.get("provider", "unknown")
        provider_counts[p] = provider_counts.get(p, 0) + 1

    counts = _bias_counts(articles)
    tracked_total = counts["LEFT"] + counts["CENTER"] + counts["RIGHT"]

    if tracked_total > 0:
        bias_distribution = {
            "left_pct": round((counts["LEFT"] / tracked_total) * 100),
            "center_pct": round((counts["CENTER"] / tracked_total) * 100),
            "right_pct": round((counts["RIGHT"] / tracked_total) * 100),
        }
    else:
        bias_distribution = {
            "left_pct": 0,
            "center_pct": 0,
            "right_pct": 0,
        }

    response_payload = {
        "query": query,
        "effective_query": effective_query,
        "is_social_media_claim": is_social_media_claim,
        "social_media_data": social_media_data,
        "articles": articles,
        "summary": summary,
        "claim_groups": claim_groups,
        "consensus": consensus,
        "verification": verification,
        "pinecone": pinecone_info,
        "total_sources": len(article_pool),
        "providers": provider_counts,
        "warning": coverage_warning,
        "coverage": {
            "left": counts["LEFT"],
            "center": counts["CENTER"],
            "right": counts["RIGHT"],
            "unknown": counts["UNKNOWN"],
            "tracked_total": tracked_total,
            "has_full_spectrum": all(counts[bias] > 0 for bias in BIAS_BUCKETS),
            "fallback_used": fallback_used,
            "distribution": bias_distribution,
        },
        "performance": {
            "elapsed_ms": round((perf_counter() - started_at) * 1000, 1),
            "budget_seconds": settings.search_latency_budget_seconds,
            "degraded_steps": degraded_steps,
        },
    }

    _set_cached_response(cache_key, response_payload)
    return response_payload
