from __future__ import annotations

from math import sqrt
from typing import Any


def _to_float_list(vector: Any) -> list[float]:
    if vector is None or isinstance(vector, (str, bytes)):
        return []

    try:
        iterator = iter(vector)
    except TypeError:
        return []

    values: list[float] = []
    for item in iterator:
        try:
            values.append(float(item))
        except (TypeError, ValueError):
            return []
    return values


def cosine_similarity(left: Any, right: Any) -> float:
    left_values = _to_float_list(left)
    right_values = _to_float_list(right)

    if not left_values or not right_values or len(left_values) != len(right_values):
        return 0.0

    dot = sum(a * b for a, b in zip(left_values, right_values))
    left_norm_sq = sum(a * a for a in left_values)
    right_norm_sq = sum(b * b for b in right_values)
    if left_norm_sq <= 0.0 or right_norm_sq <= 0.0:
        return 0.0

    return dot / (sqrt(left_norm_sq) * sqrt(right_norm_sq))


def cosine_similarity_matrix(vectors: Any) -> list[list[float]]:
    rows = [_to_float_list(vector) for vector in vectors]
    total = len(rows)

    matrix = [[0.0] * total for _ in range(total)]
    for idx, row in enumerate(rows):
        if row:
            matrix[idx][idx] = 1.0

    for i in range(total):
        for j in range(i + 1, total):
            score = cosine_similarity(rows[i], rows[j])
            matrix[i][j] = score
            matrix[j][i] = score

    return matrix


def cosine_similarity_to_many(vector: Any, others: Any) -> list[float]:
    left = _to_float_list(vector)
    rows = [_to_float_list(item) for item in others]

    if not left:
        return [0.0 for _ in rows]

    return [cosine_similarity(left, row) for row in rows]
