from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.services.claim_extractor import extract_claims
from app.services.consensus import calculate_consensus, group_claims
from app.services.news_aggregator import aggregate_search
from app.services.summarizer import generate_summary

router = APIRouter(tags=["search"])


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

    target_per_bias = 2 if limit >= 6 else 1
    for _ in range(target_per_bias):
        for bias in ("LEFT", "CENTER", "RIGHT"):
            if len(selected) >= limit:
                break
            if grouped[bias]:
                selected.append(grouped[bias].pop(0))

    selected_ids = {id(article) for article in selected}
    remaining = [
        article
        for article in sorted(raw_articles, key=_article_quality_key, reverse=True)
        if id(article) not in selected_ids
    ]
    selected.extend(remaining[: max(0, limit - len(selected))])

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

    article_limit = settings.claims_article_limit
    selected_articles = _select_balanced_articles(raw_articles, article_limit)

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

    return {
        "query": query,
        "articles": articles,
        "summary": summary,
        "claim_groups": claim_groups,
        "consensus": consensus,
        "total_sources": len(raw_articles),
        "providers": provider_counts,
    }
