from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.services.claim_extractor import extract_claims
from app.services.consensus import calculate_consensus, group_claims
from app.services.news_aggregator import aggregate_search
from app.services.social_claim_extractor import (
    detect_social_media_platform,
    extract_claim_from_social_media,
)
from app.services.summarizer import generate_summary

router = APIRouter(tags=["search"])
logger = logging.getLogger(__name__)

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

    platform, is_social_media_claim = detect_social_media_platform(query)
    social_media_data: dict[str, Any] | None = None
    effective_query = query

    if is_social_media_claim:
        social_media_data = extract_claim_from_social_media(query, platform)
        extracted_claim = social_media_data.get("extracted_claim") if social_media_data else None
        if isinstance(extracted_claim, str) and extracted_claim.strip():
            normalized_claim = extracted_claim.strip()
            if not normalized_claim.lower().startswith("no verifiable factual claim"):
                effective_query = normalized_claim

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

    # Fetch from all configured providers concurrently
    raw_articles: list[dict[str, Any]] = []
    for candidate_query in _query_variants(effective_query):
        raw_articles = aggregate_search(
            candidate_query,
            category=None,
            size_per_provider=settings.newsdata_page_size,
        )
        if raw_articles:
            break

    if not raw_articles:
        raise HTTPException(
            status_code=502,
            detail="All news providers returned empty results. Try a different query.",
        )

    article_limit = max(3, settings.claims_article_limit)
    article_pool = raw_articles
    selected_articles = _select_balanced_articles(article_pool, article_limit)
    fallback_used = False
    coverage_warning: str | None = None

    # Retry once with a broader category set if one bias side is missing.
    if not _has_full_spectrum(selected_articles):
        supplemental_articles = aggregate_search(
            effective_query,
            category=None,
            size_per_provider=max(10, settings.newsdata_page_size),
        )
        article_pool = _merge_unique_articles(raw_articles, supplemental_articles)
        selected_articles = _select_balanced_articles(article_pool, article_limit)

    if settings.require_full_spectrum and not _has_full_spectrum(selected_articles):
        fallback_used = True
        coverage_warning = (
            "Partial coverage fallback used: not enough LEFT/CENTER/RIGHT sources "
            "for this query right now."
        )
        logger.info("Using partial coverage fallback for query: %s", query)

    articles = []
    for item in selected_articles:
        title = item.get("title")
        description = item.get("description")

        article_text = "\n".join(
            part for part in [title or "", description or ""] if part
        ).strip()
        try:
            claims = extract_claims(article_text)
        except Exception:
            claims = []

        articles.append(
            {
                "title": title,
                "description": description,
                "source": item.get("source"),
                "bias": item.get("bias", "UNKNOWN"),
                "claims": claims,
                "link": item.get("link"),
                "pubDate": item.get("pubDate"),
                "image_url": item.get("image_url"),
                "provider": item.get("provider"),
            }
        )

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

    summary = generate_summary(articles)
    claim_groups = group_claims(all_claims)
    consensus = calculate_consensus(claim_groups)

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

    return {
        "query": query,
        "effective_query": effective_query,
        "is_social_media_claim": is_social_media_claim,
        "social_media_data": social_media_data,
        "articles": articles,
        "summary": summary,
        "claim_groups": claim_groups,
        "consensus": consensus,
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
    }
