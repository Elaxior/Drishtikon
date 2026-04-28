from __future__ import annotations

import json

from app.core.config import settings
from app.core.llm import get_groq_client


def extract_claims(text: str) -> list[str]:
    article_text = text.strip()
    if not article_text:
        return []

    client = get_groq_client()
    if client is None:
        return []

    prompt = f"""You are a neutral news analyst.

Extract 3-5 factual, objective claims from the text below.

Rules:

* Only include verifiable facts
* No opinions
* No speculation
* Keep each claim short (1 sentence)
* Avoid duplicates

Return JSON:
{{
\"claims\": [\"...\", \"...\"]
}}

TEXT:
{article_text}"""

    try:
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
    except Exception:
        return []

    content = ""
    if response.choices and response.choices[0].message and response.choices[0].message.content:
        content = response.choices[0].message.content

    if not content:
        return []

    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return []

    raw_claims = payload.get("claims")
    if not isinstance(raw_claims, list):
        return []

    claims: list[str] = []
    for claim in raw_claims:
        if not isinstance(claim, str):
            continue

        normalized_claim = claim.strip()
        if not normalized_claim:
            continue

        if normalized_claim not in claims:
            claims.append(normalized_claim)

    return claims[:5]
