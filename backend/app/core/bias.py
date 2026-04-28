from __future__ import annotations

import re

# Expanded bias map covering more international sources that appear
# across NewsData.io, GNews.io, and Currents API results.
BIAS_MAP: dict[str, str] = {
    # ─── CENTER ───
    "bbc": "CENTER",
    "reuters": "CENTER",
    "associated-press": "CENTER",
    "ap-news": "CENTER",
    "apnews": "CENTER",
    "ap": "CENTER",
    "the-hindu": "CENTER",
    "times-of-india": "CENTER",
    "hindustan-times": "CENTER",
    "india-today": "CENTER",
    "bloomberg": "CENTER",
    "the-wall-street-journal": "CENTER",
    "wall-street-journal": "CENTER",
    "wsj": "CENTER",
    "politico": "CENTER",
    "abc-news": "CENTER",
    "abcnews": "CENTER",
    "cbs-news": "CENTER",
    "cbsnews": "CENTER",
    "nbc-news": "CENTER",
    "nbcnews": "CENTER",
    "ctv-news": "CENTER",
    "ctvnews": "CENTER",
    "usa-today": "CENTER",
    "npr": "CENTER",
    "pbs": "CENTER",
    "the-hill": "CENTER",
    "france24": "CENTER",
    "dw": "CENTER",
    "deutsche-welle": "CENTER",
    "south-china-morning-post": "CENTER",
    "scmp": "CENTER",
    "the-diplomat": "CENTER",
    "financial-times": "CENTER",
    "the-economist": "CENTER",
    "axios": "CENTER",
    "forbes": "CENTER",

    # ─── LEFT ───
    "cnn": "LEFT",
    "msnbc": "LEFT",
    "al-jazeera": "LEFT",
    "aljazeera": "LEFT",
    "ndtv": "LEFT",
    "the-guardian": "LEFT",
    "guardian": "LEFT",
    "the-new-york-times": "LEFT",
    "nyt": "LEFT",
    "washington-post": "LEFT",
    "the-washington-post": "LEFT",
    "huffpost": "LEFT",
    "huffington-post": "LEFT",
    "the-intercept": "LEFT",
    "vox": "LEFT",
    "vice": "LEFT",
    "democracy-now": "LEFT",
    "mother-jones": "LEFT",
    "salon": "LEFT",
    "the-wire": "LEFT",
    "scroll": "LEFT",
    "independent": "LEFT",
    "the-independent": "LEFT",
    "mirror": "LEFT",
    "daily-mirror": "LEFT",

    # ─── RIGHT ───
    "fox-news": "RIGHT",
    "foxnews": "RIGHT",
    "opindia": "RIGHT",
    "breitbart": "RIGHT",
    "daily-caller": "RIGHT",
    "the-daily-wire": "RIGHT",
    "daily-wire": "RIGHT",
    "new-york-post": "RIGHT",
    "ny-post": "RIGHT",
    "washington-examiner": "RIGHT",
    "washington-times": "RIGHT",
    "national-review": "RIGHT",
    "the-epoch-times": "RIGHT",
    "epoch-times": "RIGHT",
    "newsmax": "RIGHT",
    "oann": "RIGHT",
    "one-america-news": "RIGHT",
    "republic-world": "RIGHT",
    "republic-tv": "RIGHT",
    "zee-news": "RIGHT",
    "swarajya": "RIGHT",
    "daily-mail": "RIGHT",
    "dailymail": "RIGHT",
}


def _normalize_source(source: str) -> str:
    normalized = source.strip().lower()
    # Normalize minor formatting differences so map lookups stay stable.
    normalized = re.sub(r"[^a-z0-9]+", "", normalized)
    return normalized


_NORMALIZED_BIAS_MAP: dict[str, str] = {
    _normalize_source(key): value for key, value in BIAS_MAP.items()
}


def get_bias(source: str) -> str:
    normalized_source = _normalize_source(source or "")
    if not normalized_source:
        return "UNKNOWN"

    # Direct lookup
    result = _NORMALIZED_BIAS_MAP.get(normalized_source)
    if result:
        return result

    # Partial match: check if any known source slug is contained
    for key, bias in _NORMALIZED_BIAS_MAP.items():
        if key in normalized_source or normalized_source in key:
            return bias

    return "UNKNOWN"
