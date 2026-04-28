from __future__ import annotations

from collections import defaultdict
from typing import Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import settings
from app.services.embeddings import get_embedding_model


def _get_embedding_model() -> Any | None:
    return get_embedding_model(settings.consensus_embedding_model)


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
        biases = [entry.get("bias", "UNKNOWN") for entry in claims]
        source_biases = []
        seen_sb: set[str] = set()
        for entry in claims:
            key = f"{entry['source']}|{entry.get('bias', 'UNKNOWN')}"
            if key not in seen_sb:
                seen_sb.add(key)
                source_biases.append({
                    "source": entry["source"],
                    "bias": entry.get("bias", "UNKNOWN"),
                })
        groups.append(
            {
                "representative_claim": representative_claim,
                "sources": sources,
                "source_biases": source_biases,
                "bias_breakdown": _bias_breakdown(biases),
                "count": len(claims),
            }
        )

    groups.sort(key=lambda group: group["count"], reverse=True)
    return groups


def _bias_breakdown(biases: list[str]) -> dict[str, int]:
    """Count how many LEFT/CENTER/RIGHT sources back a claim group."""
    counts = {"LEFT": 0, "CENTER": 0, "RIGHT": 0, "UNKNOWN": 0}
    for bias in biases:
        b = bias if bias in counts else "UNKNOWN"
        counts[b] += 1
    return counts


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
        bias_value = item.get("bias", "UNKNOWN")

        cleaned_claims.append({"source": source, "claim": claim, "bias": bias_value})

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
        biases = [cleaned_claims[idx].get("bias", "UNKNOWN") for idx in indices]
        source_biases = []
        seen_sb: set[str] = set()
        for idx in indices:
            entry = cleaned_claims[idx]
            key = f"{entry['source']}|{entry.get('bias', 'UNKNOWN')}"
            if key not in seen_sb:
                seen_sb.add(key)
                source_biases.append({
                    "source": entry["source"],
                    "bias": entry.get("bias", "UNKNOWN"),
                })
        groups.append(
            {
                "representative_claim": representative_claim,
                "sources": sources,
                "source_biases": source_biases,
                "bias_breakdown": _bias_breakdown(biases),
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


def generate_consensus_report(
    claim_groups: list[dict[str, Any]],
    verification: dict[str, Any] | None,
    coverage: dict[str, Any] | None,
    consensus_score: float,
) -> dict[str, Any]:
    """Generate a structured consensus report summarizing the analysis."""

    total_claims = len(claim_groups)
    supported = 0
    contradicted = 0
    mixed = 0
    uncertain = 0
    high_confidence_claims: list[dict[str, Any]] = []
    top_agreed_claims: list[dict[str, Any]] = []
    cross_spectrum_claims: list[dict[str, Any]] = []

    for group in claim_groups:
        verdict = str(group.get("verdict", "UNCERTAIN")).upper()
        if verdict == "SUPPORTED":
            supported += 1
        elif verdict == "CONTRADICTED":
            contradicted += 1
        elif verdict == "MIXED":
            mixed += 1
        else:
            uncertain += 1

        confidence = group.get("confidence", 0)
        if isinstance(confidence, (int, float)) and confidence >= 70:
            high_confidence_claims.append({
                "claim": group.get("representative_claim", ""),
                "confidence": confidence,
                "verdict": verdict,
                "source_count": group.get("count", 0),
            })

        # Claims agreed by 3+ sources
        if group.get("count", 0) >= 3:
            top_agreed_claims.append({
                "claim": group.get("representative_claim", ""),
                "source_count": group.get("count", 0),
                "sources": group.get("sources", []),
            })

        # Cross-spectrum: claims reported by sources of different biases
        breakdown = group.get("bias_breakdown", {})
        spectrum_count = sum(1 for b in ("LEFT", "CENTER", "RIGHT") if breakdown.get(b, 0) > 0)
        if spectrum_count >= 2:
            cross_spectrum_claims.append({
                "claim": group.get("representative_claim", ""),
                "bias_breakdown": breakdown,
                "source_count": group.get("count", 0),
                "spectrum_breadth": spectrum_count,
            })

    # Overall reliability assessment
    if consensus_score >= 75 and supported > contradicted:
        reliability = "HIGH"
        reliability_description = "Strong cross-source agreement with minimal contradictions."
    elif consensus_score >= 50 and contradicted <= mixed:
        reliability = "MODERATE"
        reliability_description = "Moderate agreement across sources with some mixed signals."
    elif contradicted > supported:
        reliability = "LOW"
        reliability_description = "Significant contradictions detected across sources."
    else:
        reliability = "UNCERTAIN"
        reliability_description = "Insufficient data for a confident reliability assessment."

    # Key findings
    key_findings: list[str] = []
    if top_agreed_claims:
        key_findings.append(
            f"{len(top_agreed_claims)} claim(s) are agreed upon by 3 or more sources."
        )
    if cross_spectrum_claims:
        key_findings.append(
            f"{len(cross_spectrum_claims)} claim(s) are reported across multiple bias perspectives."
        )
    if contradicted > 0:
        key_findings.append(
            f"{contradicted} claim(s) have contradictory evidence from different sources."
        )
    if high_confidence_claims:
        key_findings.append(
            f"{len(high_confidence_claims)} claim(s) have 70%+ verification confidence."
        )

    has_left = (coverage or {}).get("left", 0) > 0
    has_center = (coverage or {}).get("center", 0) > 0
    has_right = (coverage or {}).get("right", 0) > 0
    spectrum_label = []
    if has_left:
        spectrum_label.append("Left")
    if has_center:
        spectrum_label.append("Center")
    if has_right:
        spectrum_label.append("Right")

    return {
        "reliability": reliability,
        "reliability_description": reliability_description,
        "consensus_score": round(consensus_score, 1),
        "total_claims_analyzed": total_claims,
        "verdict_distribution": {
            "supported": supported,
            "contradicted": contradicted,
            "mixed": mixed,
            "uncertain": uncertain,
        },
        "key_findings": key_findings,
        "top_agreed_claims": top_agreed_claims[:5],
        "cross_spectrum_claims": cross_spectrum_claims[:5],
        "high_confidence_claims": high_confidence_claims[:5],
        "spectrum_coverage": " + ".join(spectrum_label) if spectrum_label else "None",
        "spectrum_complete": has_left and has_center and has_right,
    }
