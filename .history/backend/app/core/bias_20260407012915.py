from __future__ import annotations

import re

BIAS_MAP: dict[str, str] = {
    "bbc": "CENTER",
    "reuters": "CENTER",
    "cnn": "LEFT",
    "fox-news": "RIGHT",
    "al-jazeera": "LEFT",
    "the-hindu": "CENTER",
    "times-of-india": "CENTER",
    "ndtv": "LEFT",
    "opindia": "RIGHT",
}


def _normalize_source(source: str) -> str:
    normalized = source.strip().lower()
    # Normalize minor formatting differences so map lookups stay stable.
    normalized = re.sub(r"[\s_-]+", "", normalized)
    return normalized


_NORMALIZED_BIAS_MAP: dict[str, str] = {
    _normalize_source(key): value for key, value in BIAS_MAP.items()
}


def get_bias(source: str) -> str:
    normalized_source = _normalize_source(source or "")
    if not normalized_source:
        return "UNKNOWN"

    return _NORMALIZED_BIAS_MAP.get(normalized_source, "UNKNOWN")
