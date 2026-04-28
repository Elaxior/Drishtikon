from __future__ import annotations

from threading import Lock
from typing import Any

try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None  # type: ignore[assignment]

_model_lock = Lock()
_models: dict[str, Any] = {}


def get_embedding_model(model_name: str) -> Any | None:
    if SentenceTransformer is None:
        return None

    normalized_name = (model_name or "").strip()
    if not normalized_name:
        return None

    cached = _models.get(normalized_name)
    if cached is not None:
        return cached

    with _model_lock:
        cached = _models.get(normalized_name)
        if cached is not None:
            return cached

        model = SentenceTransformer(normalized_name)
        _models[normalized_name] = model
        return model
