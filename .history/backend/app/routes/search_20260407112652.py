from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.services.claim_extractor import extract_claims
from app.services.consensus import calculate_consensus, group_claims
from app.services.news_aggregator import aggregate_search
from app.services.summarizer import generate_summary

router = APIRouter(tags=["search"])

BIAS_BUCKETS = ("LEFT", "CENTER", "RIGHT")


def _article_quality_key(article: dict[str, Any]) -> tuple[int, int, int, int]:
    image_url = article.get("image_url")
    has_image = isinstance(image_url, str) and bool(image_url.strip())

    link = article.get("link")
    has_link = isinstance(link, str) and bool(link.strip())

    source = article.get("source")
    has_source = isinstance(source, str) and source.strip().lower() not in {"", "unknown"}

    bias = article.get("bias", "UNKNOWN")
    known_bias = bias in {"LEFT", "CENTER", "RIGHT"}

    return (
        int(has_image),
        int(known_bias),
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

    return selected


@router.get("/search")
def search_news(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query parameter 'q' cannot be empty.")

    # Check that at least one news API key is configured
    has_provider = any([
        settings.newsdata_api_key and settings.newsdata_api_key != "your_key_here",
        settings.gnews_api_key,
        settings.currents_api_key,
    ])
    if not has_provider:
        raise HTTPException(
            status_code=500,
            detail="No news API keys are configured on the server.",
        )

    # Fetch from all configured providers concurrently
    raw_articles = aggregate_search(
        query,
        category="world,politics",
        size_per_provider=settings.newsdata_page_size,
    )

    if not raw_articles:
        raise HTTPException(
            status_code=502,
            detail="All news providers returned empty results. Try a different query.",
        )

    article_limit = max(3, settings.claims_article_limit)
    article_pool = raw_articles
    selected_articles = _select_balanced_articles(article_pool, article_limit)

    # Retry once with a broader category set if one bias side is missing.
    if not _has_full_spectrum(selected_articles):
        supplemental_articles = aggregate_search(
            query,
            category=None,
            size_per_provider=max(10, settings.newsdata_page_size),
        )
        article_pool = _merge_unique_articles(raw_articles, supplemental_articles)
        selected_articles = _select_balanced_articles(article_pool, article_limit)

    if settings.require_full_spectrum and not _has_full_spectrum(selected_articles):
        raise HTTPException(
            status_code=422,
            detail=(
                "Not enough balanced coverage for this query. "
                "Need at least one LEFT, one CENTER, and one RIGHT source."
            ),
        )

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
        "articles": articles,
        "summary": summary,
        "claim_groups": claim_groups,
        "consensus": consensus,
        "total_sources": len(article_pool),
        "providers": provider_counts,
        "coverage": {
            "left": counts["LEFT"],
            "center": counts["CENTER"],
            "right": counts["RIGHT"],
            "unknown": counts["UNKNOWN"],
            "tracked_total": tracked_total,
            "has_full_spectrum": all(counts[bias] > 0 for bias in BIAS_BUCKETS),
            "distribution": bias_distribution,
        },
    }
