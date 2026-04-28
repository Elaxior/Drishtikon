from __future__ import annotations

from collections import defaultdict
from threading import Lock
from typing import Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None  # type: ignore[assignment]

from app.core.config import settings

_model_lock = Lock()
_model: SentenceTransformer | None = None


def _get_embedding_model() -> SentenceTransformer | None:
    global _model

    if SentenceTransformer is None:
        return None

    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer("all-MiniLM-L6-v2")

    return _model


def _unique_in_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique_values: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        unique_values.append(value)
    return unique_values


def _fallback_group_claims(cleaned_claims: list[dict[str, str]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for item in cleaned_claims:
        grouped[item["claim"].strip().lower()].append(item)

    groups: list[dict[str, Any]] = []
    for claims in grouped.values():
        representative_claim = claims[0]["claim"]
        sources = _unique_in_order([entry["source"] for entry in claims])
        groups.append(
            {
                "representative_claim": representative_claim,
                "sources": sources,
                "count": len(claims),
            }
        )

    groups.sort(key=lambda group: group["count"], reverse=True)
    return groups


def group_claims(all_claims: list[dict]) -> list[dict[str, Any]]:
    cleaned_claims: list[dict[str, str]] = []
    for item in all_claims:
        if not isinstance(item, dict):
            continue

        claim_value = item.get("claim")
        if not isinstance(claim_value, str):
            continue

        claim = claim_value.strip()
        if not claim:
            continue

        source_value = item.get("source")
        source = source_value.strip() if isinstance(source_value, str) and source_value.strip() else "Unknown"

        cleaned_claims.append({"source": source, "claim": claim})

    if not cleaned_claims:
        return []

    model = _get_embedding_model()
    if model is None:
        return _fallback_group_claims(cleaned_claims)

    try:
        claims_text = [item["claim"] for item in cleaned_claims]
        embeddings = model.encode(claims_text, normalize_embeddings=True)
        matrix = cosine_similarity(np.asarray(embeddings))
    except Exception:
        return _fallback_group_claims(cleaned_claims)

    total_claims = len(cleaned_claims)
    parent = list(range(total_claims))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    threshold = settings.consensus_similarity_threshold
    for i in range(total_claims):
        for j in range(i + 1, total_claims):
            if float(matrix[i][j]) >= threshold:
                union(i, j)

    grouped_indices: dict[int, list[int]] = defaultdict(list)
    for index in range(total_claims):
        grouped_indices[find(index)].append(index)

    groups: list[dict[str, Any]] = []
    for indices in grouped_indices.values():
        representative_claim = cleaned_claims[indices[0]]["claim"]
        sources = _unique_in_order([cleaned_claims[idx]["source"] for idx in indices])
        groups.append(
            {
                "representative_claim": representative_claim,
                "sources": sources,
                "count": len(indices),
            }
        )

    groups.sort(key=lambda group: group["count"], reverse=True)
    return groups


def calculate_consensus(groups: list) -> float:
    if not groups:
        return 0.0

    counts: list[int] = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        count = group.get("count")
        if isinstance(count, int) and count > 0:
            counts.append(count)

    if not counts:
        return 0.0

    largest_group_size = max(counts)
    total_claims = sum(counts)
    if total_claims == 0:
        return 0.0

    score = (largest_group_size / total_claims) * 100
    return round(score, 2)
