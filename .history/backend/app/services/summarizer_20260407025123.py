from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.core.llm import get_groq_client

SUMMARY_FALLBACK = "Summary unavailable"
MAX_SUMMARY_ARTICLES = 5
MAX_DESCRIPTION_CHARS = 280


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def _truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def _prepare_articles_text(articles: list) -> str:
    lines: list[str] = []

    for article in articles[:MAX_SUMMARY_ARTICLES]:
        if not isinstance(article, dict):
            continue

        source = _clean_text(article.get("source")) or "Unknown"
        bias = _clean_text(article.get("bias")) or "UNKNOWN"
        title = _clean_text(article.get("title")) or "N/A"
        description = _clean_text(article.get("description")) or "N/A"
        description = _truncate_text(description, MAX_DESCRIPTION_CHARS)

        lines.append(f"Source: {source} ({bias})")
        lines.append(f"Title: {title}")
        lines.append(f"Description: {description}")
        lines.append("")

    return "\n".join(lines).strip()


def generate_summary(articles: list) -> str:
    if not isinstance(articles, list) or not articles:
        return SUMMARY_FALLBACK

    articles_text = _prepare_articles_text(articles)
    if not articles_text:
        return SUMMARY_FALLBACK

    client = get_groq_client()
    if client is None:
        return SUMMARY_FALLBACK

    prompt = f"""You are a neutral geopolitical analyst.

Your task is to generate a factual, unbiased summary of the news below.

Rules:

* Combine information from all sources
* Remove opinions, speculation, and emotional language
* Do not favor any political side
* Focus only on verifiable facts
* Keep it concise (5–7 sentences max)

NEWS:
{articles_text}"""

    try:
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
    except Exception:
        return SUMMARY_FALLBACK

    if not response.choices or not response.choices[0].message:
        return SUMMARY_FALLBACK

    content = response.choices[0].message.content
    if not content:
        return SUMMARY_FALLBACK

    summary = content.strip()
    return summary or SUMMARY_FALLBACK
