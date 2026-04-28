from __future__ import annotations

from typing import Any

import requests
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings

router = APIRouter(tags=["search"])


@router.get("/search")
def search_news(q: str = Query(..., min_length=1)) -> dict[str, Any]:
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query parameter 'q' cannot be empty.")

    if not settings.newsdata_api_key:
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
        raise HTTPException(
            status_code=502,
            detail=payload.get("results") or payload.get("message") or "News provider error.",
        )

    raw_articles = payload.get("results")
    if not isinstance(raw_articles, list):
        raw_articles = []

    articles = []
    for item in raw_articles[: settings.newsdata_page_size]:
        if not isinstance(item, dict):
            continue

        articles.append(
            {
                "title": item.get("title"),
                "description": item.get("description"),
                "source": item.get("source_id") or item.get("source_name"),
                "link": item.get("link"),
                "pubDate": item.get("pubDate"),
            }
        )

    return {
        "query": query,
        "articles": articles,
    }
