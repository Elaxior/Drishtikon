from __future__ import annotations

import importlib
from threading import Lock
from typing import Any

_model_lock = Lock()
_models: dict[str, Any] = {}
_sentence_transformer_checked = False
_sentence_transformer_class: Any | None = None


def _get_sentence_transformer_class() -> Any | None:
    global _sentence_transformer_checked, _sentence_transformer_class

    if _sentence_transformer_checked:
        return _sentence_transformer_class

    with _model_lock:
        if _sentence_transformer_checked:
            return _sentence_transformer_class

        try:
            module = importlib.import_module("sentence_transformers")
            _sentence_transformer_class = getattr(module, "SentenceTransformer", None)
        except Exception:
            _sentence_transformer_class = None
        finally:
            _sentence_transformer_checked = True

    return _sentence_transformer_class


def get_embedding_model(model_name: str) -> Any | None:
    sentence_transformer_class = _get_sentence_transformer_class()
    if sentence_transformer_class is None:
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

        model = sentence_transformer_class(normalized_name)
        _models[normalized_name] = model
        return model
