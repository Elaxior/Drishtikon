from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import settings
from app.services.embeddings import get_embedding_model

VERDICTS = ("SUPPORTED", "CONTRADICTED", "MIXED", "UNCERTAIN")
CONTRADICTION_HINTS = {
    "false",
    "fake",
    "misleading",
    "debunk",
    "debunked",
    "refute",
    "refuted",
    "denied",
    "not true",
    "no evidence",
    "incorrect",
}

_CACHE_LOCK = Lock()
_VERIFIER_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}


def _normalize(text: str) -> str:
    return " ".join(text.split()).strip().lower()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _cache_key(claim: str) -> str:
    # Bucket cache by day so stale verification naturally rotates out.
    date_bucket = _now_utc().strftime("%Y-%m-%d")
    return f"{_normalize(claim)}|{date_bucket}"


def _cache_get(key: str) -> dict[str, Any] | None:
    if settings.verification_cache_ttl_seconds <= 0:
        return None

    with _CACHE_LOCK:
        cached = _VERIFIER_CACHE.get(key)
        if cached is None:
            return None

        expires_at, payload = cached
        if _now_utc() > expires_at:
            _VERIFIER_CACHE.pop(key, None)
            return None

        return payload


def _cache_set(key: str, payload: dict[str, Any]) -> None:
    if settings.verification_cache_ttl_seconds <= 0:
        return

    expires_at = _now_utc() + timedelta(seconds=settings.verification_cache_ttl_seconds)
    with _CACHE_LOCK:
        _VERIFIER_CACHE[key] = (expires_at, payload)


def _build_article_text(article: dict[str, Any]) -> str:
    title = article.get("title")
    description = article.get("description")
    chunks: list[str] = []
    if isinstance(title, str) and title.strip():
        chunks.append(title.strip())
    if isinstance(description, str) and description.strip():
        chunks.append(description.strip())
    return "\n".join(chunks).strip()


def _contains_contradiction_hint(text: str) -> bool:
    normalized = _normalize(text)
    return any(hint in normalized for hint in CONTRADICTION_HINTS)


def _evidence_candidates(claim: str, articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    snippets: list[str] = []
    snippet_meta: list[dict[str, Any]] = []

    for article in articles:
        article_text = _build_article_text(article)
        if not article_text:
            continue

        snippets.append(article_text)
        snippet_meta.append(
            {
                "source": article.get("source"),
                "title": article.get("title"),
                "link": article.get("link"),
                "bias": article.get("bias", "UNKNOWN"),
                "snippet": article_text[:220],
            }
        )

    if not snippets:
        return []

    model = get_embedding_model(settings.consensus_embedding_model)
    if model is None:
        # Fallback: no embedding model available, use top snippets as weak evidence.
        fallback = snippet_meta[: settings.verification_evidence_limit]
        for item in fallback:
            item["similarity"] = 0.0
            item["has_contradiction_hint"] = _contains_contradiction_hint(item.get("snippet") or "")
        return fallback

    try:
        claim_embedding = model.encode([claim], normalize_embeddings=True)
        snippet_embeddings = model.encode(snippets, normalize_embeddings=True)
        similarity_scores = cosine_similarity(np.asarray(claim_embedding), np.asarray(snippet_embeddings))[0]
    except Exception:
        fallback = snippet_meta[: settings.verification_evidence_limit]
        for item in fallback:
            item["similarity"] = 0.0
            item["has_contradiction_hint"] = _contains_contradiction_hint(item.get("snippet") or "")
        return fallback

    ranked_indices = sorted(
        range(len(snippet_meta)),
        key=lambda index: float(similarity_scores[index]),
        reverse=True,
    )

    evidence: list[dict[str, Any]] = []
    for index in ranked_indices[: settings.verification_evidence_limit]:
        item = dict(snippet_meta[index])
        similarity = round(float(similarity_scores[index]), 4)
        item["similarity"] = similarity
        item["has_contradiction_hint"] = _contains_contradiction_hint(item.get("snippet") or "")
        evidence.append(item)

    return evidence


def _build_uncertain_verification(reason: str = "insufficient_evidence") -> dict[str, Any]:
    return {
        "verdict": "UNCERTAIN",
        "confidence": 0,
        "evidence": [],
        "reason": reason,
        "verified_at": _now_utc().isoformat(),
    }


def _infer_verdict(evidence: list[dict[str, Any]]) -> tuple[str, int]:
    if not evidence:
        return "UNCERTAIN", 0

    similarities = [float(item.get("similarity", 0.0)) for item in evidence]
    top_similarity = max(similarities)
    average_similarity = sum(similarities) / len(similarities)

    if top_similarity < settings.verification_similarity_threshold:
        confidence = int(round(max(0.0, average_similarity) * 100))
        return "UNCERTAIN", max(10, min(50, confidence))

    contradiction_hits = sum(1 for item in evidence if item.get("has_contradiction_hint"))
    support_hits = len(evidence) - contradiction_hits

    unique_sources = {
        _normalize(str(item.get("source") or "unknown"))
        for item in evidence
    }
    diversity_bonus = min(12, len(unique_sources) * 4)
    confidence = int(round(average_similarity * 100)) + diversity_bonus
    confidence = max(35, min(97, confidence))

    if contradiction_hits > 0 and support_hits > 0:
        return "MIXED", confidence
    if contradiction_hits > 0 and support_hits == 0:
        return "CONTRADICTED", confidence
    return "SUPPORTED", confidence


def verify_claim_group(claim: str, articles: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_claim = claim.strip()
    if not normalized_claim:
        return _build_uncertain_verification("empty_claim")

    key = _cache_key(normalized_claim)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    try:
        evidence = _evidence_candidates(normalized_claim, articles)
        verdict, confidence = _infer_verdict(evidence)
        payload = {
            "verdict": verdict,
            "confidence": confidence,
            "evidence": evidence,
            "reason": "ok",
            "verified_at": _now_utc().isoformat(),
        }
    except Exception:
        if not settings.verifier_fail_open:
            raise
        payload = _build_uncertain_verification("verifier_exception")

    _cache_set(key, payload)
    return payload


def summarize_verification(claim_groups: list[dict[str, Any]]) -> dict[str, Any]:
    distribution = {
        "supported": 0,
        "contradicted": 0,
        "mixed": 0,
        "uncertain": 0,
    }

    confidence_values: list[int] = []
    for group in claim_groups:
        verdict = str(group.get("verdict") or "UNCERTAIN").upper()
        if verdict not in VERDICTS:
            verdict = "UNCERTAIN"

        if verdict == "SUPPORTED":
            distribution["supported"] += 1
        elif verdict == "CONTRADICTED":
            distribution["contradicted"] += 1
        elif verdict == "MIXED":
            distribution["mixed"] += 1
        else:
            distribution["uncertain"] += 1

        confidence = group.get("confidence")
        if isinstance(confidence, int):
            confidence_values.append(confidence)

    total = max(1, len(claim_groups))
    supported_ratio = distribution["supported"] / total
    contradicted_ratio = distribution["contradicted"] / total
    mixed_ratio = distribution["mixed"] / total

    consensus_score = int(round((supported_ratio * 100) - (contradicted_ratio * 35) - (mixed_ratio * 20)))
    consensus_score = max(0, min(100, consensus_score))

    if distribution["contradicted"] > distribution["supported"]:
        overall_verdict = "CONTRADICTED"
    elif distribution["supported"] > 0 and distribution["mixed"] == 0 and distribution["contradicted"] == 0:
        overall_verdict = "SUPPORTED"
    elif distribution["mixed"] > 0:
        overall_verdict = "MIXED"
    else:
        overall_verdict = "UNCERTAIN"

    avg_confidence = int(round(sum(confidence_values) / len(confidence_values))) if confidence_values else 0

    return {
        "label": settings.verification_label,
        "overall_verdict": overall_verdict,
        "confidence": avg_confidence,
        "consensus_score": consensus_score,
        "verified_claims": len(claim_groups),
        "distribution": distribution,
    }
