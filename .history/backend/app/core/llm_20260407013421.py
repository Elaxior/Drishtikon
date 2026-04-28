from __future__ import annotations

from groq import Groq

from app.core.config import settings

_groq_client: Groq | None = None


def get_groq_client() -> Groq | None:
    global _groq_client

    if not settings.groq_api_key or settings.groq_api_key == "your_key_here":
        return None

    if _groq_client is None:
        _groq_client = Groq(api_key=settings.groq_api_key)

    return _groq_client
