from __future__ import annotations

from typing import Any

import requests
from fastapi import APIRouter, HTTPException, Query

from app.core.bias import get_bias
from app.core.config import settings
from app.services.claim_extractor import extract_claims

router = APIRouter(tags=["search"])


@router.get("/search")
def search_news(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query parameter 'q' cannot be empty.")

    if not settings.newsdata_api_key or settings.newsdata_api_key == "your_key_here":
        raise HTTPException(
            status_code=500,
            detail="NEWSDATA_API_KEY is not configured on the server.",
        )

    params = {
        "apikey": settings.newsdata_api_key,
        "q": query,
        "language": "en",
        "category": "world,politics",
        "size": settings.newsdata_page_size,
    }

    try:
        response = requests.get(
            f"{settings.newsdata_base_url}/latest",
            params=params,
            timeout=settings.newsdata_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch news from provider.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="News provider returned invalid JSON.",
        ) from exc

    if payload.get("status") == "error":
        provider_detail = payload.get("results") or payload.get("message")
        if isinstance(provider_detail, list):
            provider_detail = ", ".join(str(item) for item in provider_detail if item)
        if not isinstance(provider_detail, str) or not provider_detail.strip():
            provider_detail = "News provider error."

        raise HTTPException(
            status_code=502,
            detail=provider_detail,
        )

    raw_articles = payload.get("results")
    if not isinstance(raw_articles, list):
        raw_articles = []

    article_limit = min(settings.newsdata_page_size, settings.claims_article_limit)

    articles = []
    for item in raw_articles[:article_limit]:
        if not isinstance(item, dict):
            continue

        title_value = item.get("title")
        description_value = item.get("description")

        title = title_value if isinstance(title_value, str) else None
        description = description_value if isinstance(description_value, str) else None

        source_value = item.get("source_id") or item.get("source_name")
        source = source_value if isinstance(source_value, str) else None
        bias = get_bias(source or "")

        article_text = "\n".join(part for part in [title or "", description or ""] if part).strip()
        try:
            claims = extract_claims(article_text)
        except Exception:
            claims = []

        articles.append(
            {
                "title": title,
                "description": description,
                "source": source,
                "bias": bias,
                "claims": claims,
                "link": item.get("link"),
                "pubDate": item.get("pubDate"),
            }
        )

    return {
        "query": query,
        "articles": articles,
    }
