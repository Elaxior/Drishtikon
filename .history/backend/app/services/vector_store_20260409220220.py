from __future__ import annotations

import hashlib
import importlib
import logging
from datetime import datetime, timezone
from threading import Lock
from typing import Any

try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None  # type: ignore[assignment]

from app.core.config import settings

logger = logging.getLogger(__name__)

_client_lock = Lock()
_client: Any | None = None
_index_lock = Lock()
_index: Any | None = None
_model_lock = Lock()
_model: Any | None = None
_pinecone_checked = False
_pinecone_class: Any | None = None
_serverless_spec_class: Any | None = None


def _get_pinecone_types() -> tuple[Any | None, Any | None]:
    global _pinecone_checked, _pinecone_class, _serverless_spec_class

    if not _pinecone_checked:
        try:
            module = importlib.import_module("pinecone")
            _pinecone_class = getattr(module, "Pinecone", None)
            _serverless_spec_class = getattr(module, "ServerlessSpec", None)
        except Exception:
            _pinecone_class = None
            _serverless_spec_class = None
        finally:
            _pinecone_checked = True

    return _pinecone_class, _serverless_spec_class


def _enabled() -> bool:
    pinecone_class, serverless_spec_class = _get_pinecone_types()
    api_key = (settings.pinecone_api_key or "").strip()

    return bool(
        settings.enable_pinecone
        and api_key
        and api_key != "your_pinecone_key_here"
        and settings.pinecone_index_name
        and pinecone_class is not None
        and serverless_spec_class is not None
    )


def _get_embedding_model() -> Any | None:
    global _model

    if SentenceTransformer is None:
        return None

    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer("all-MiniLM-L6-v2")

    return _model


def _get_client() -> Any | None:
    global _client

    if not _enabled():
        return None

    pinecone_class, _ = _get_pinecone_types()
    if pinecone_class is None:
        return None

    if _client is None:
        with _client_lock:
            if _client is None:
                _client = pinecone_class(api_key=settings.pinecone_api_key)

    return _client


def _ensure_index(client: Any) -> bool:
    _, serverless_spec_class = _get_pinecone_types()
    if serverless_spec_class is None:
        return False

    try:
        names = set(client.list_indexes().names())
    except Exception as exc:
        logger.warning("Pinecone list indexes failed: %s", exc)
        return False

    if settings.pinecone_index_name in names:
        return True

    try:
        client.create_index(
            name=settings.pinecone_index_name,
            dimension=384,
            metric="cosine",
            spec=serverless_spec_class(
                cloud=settings.pinecone_cloud,
                region=settings.pinecone_region,
            ),
        )
        return True
    except Exception as exc:
        logger.warning("Pinecone create index failed: %s", exc)
        return False


def _get_index() -> Any | None:
    global _index

    client = _get_client()
    if client is None:
        return None

    if _index is None:
        with _index_lock:
            if _index is None:
                if not _ensure_index(client):
                    return None
                _index = client.Index(settings.pinecone_index_name)

    return _index


def _claim_id(claim: str, source: str, link: str | None) -> str:
    base = f"{claim.strip().lower()}|{source.strip().lower()}|{(link or '').strip().lower()}"
    digest = hashlib.sha256(base.encode("utf-8")).hexdigest()
    return f"claim-{digest[:32]}"


def _embed_claims(claims: list[str]) -> list[list[float]] | None:
    model = _get_embedding_model()
    if model is None:
        return None

    try:
        vectors = model.encode(claims, normalize_embeddings=True)
        return [vector.tolist() for vector in vectors]
    except Exception as exc:
        logger.warning("Claim embedding failed: %s", exc)
        return None


def _safe_metadata_value(value: Any, max_len: int = 1000) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return text[:max_len]


def summarize_historical_matches(all_claims: list[dict[str, str]]) -> dict[str, Any] | None:
    index = _get_index()
    if index is None:
        return None

    claim_texts = [item["claim"] for item in all_claims if isinstance(item.get("claim"), str)]
    if not claim_texts:
        return {
            "enabled": True,
            "matched_claims": 0,
            "total_matches": 0,
            "top_k": settings.pinecone_top_k,
        }

    vectors = _embed_claims(claim_texts)
    if vectors is None:
        return None

    matched_claims = 0
    total_matches = 0

    for claim_text, vector in zip(claim_texts[: settings.pinecone_query_claim_limit], vectors):
        try:
            response = index.query(
                vector=vector,
                top_k=settings.pinecone_top_k,
                include_metadata=True,
                namespace=settings.pinecone_namespace,
            )
        except Exception:
            continue

        matches = response.get("matches", []) if isinstance(response, dict) else getattr(response, "matches", [])
        local_hits = 0
        for match in matches or []:
            score = float(match.get("score", 0.0) if isinstance(match, dict) else getattr(match, "score", 0.0))
            if score < settings.pinecone_match_threshold:
                continue

            metadata = match.get("metadata", {}) if isinstance(match, dict) else getattr(match, "metadata", {})
            existing_claim = _safe_metadata_value(metadata.get("claim", "")) if isinstance(metadata, dict) else ""
            if existing_claim and existing_claim.strip().lower() == claim_text.strip().lower():
                continue

            local_hits += 1

        if local_hits > 0:
            matched_claims += 1
            total_matches += local_hits

    return {
        "enabled": True,
        "matched_claims": matched_claims,
        "total_matches": total_matches,
        "top_k": settings.pinecone_top_k,
    }


def upsert_claims(all_claims: list[dict[str, str]], query: str, articles: list[dict[str, Any]]) -> int:
    index = _get_index()
    if index is None:
        return 0

    claim_records: list[dict[str, Any]] = []
    for claim_item in all_claims:
        claim = claim_item.get("claim")
        source = claim_item.get("source")
        if not isinstance(claim, str) or not claim.strip():
            continue
        if not isinstance(source, str) or not source.strip():
            source = "Unknown"

        article = next(
            (
                item
                for item in articles
                if isinstance(item.get("source"), str)
                and item.get("source", "").strip().lower() == source.strip().lower()
                and isinstance(item.get("claims"), list)
                and claim in item.get("claims", [])
            ),
            None,
        )

        claim_records.append(
            {
                "claim": claim.strip(),
                "source": source.strip(),
                "link": article.get("link") if isinstance(article, dict) else None,
                "bias": article.get("bias") if isinstance(article, dict) else None,
                "provider": article.get("provider") if isinstance(article, dict) else None,
                "pubDate": article.get("pubDate") if isinstance(article, dict) else None,
            }
        )

    if not claim_records:
        return 0

    vectors = _embed_claims([record["claim"] for record in claim_records])
    if vectors is None:
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()
    payload = []
    for record, vector in zip(claim_records, vectors):
        payload.append(
            {
                "id": _claim_id(record["claim"], record["source"], record.get("link")),
                "values": vector,
                "metadata": {
                    "claim": _safe_metadata_value(record["claim"], 800),
                    "source": _safe_metadata_value(record["source"], 200),
                    "query": _safe_metadata_value(query, 300),
                    "bias": _safe_metadata_value(record.get("bias"), 50),
                    "provider": _safe_metadata_value(record.get("provider"), 50),
                    "link": _safe_metadata_value(record.get("link"), 700),
                    "pubDate": _safe_metadata_value(record.get("pubDate"), 100),
                    "indexedAt": now_iso,
                },
            }
        )

    try:
        index.upsert(vectors=payload, namespace=settings.pinecone_namespace)
        return len(payload)
    except Exception as exc:
        logger.warning("Pinecone upsert failed: %s", exc)
        return 0


def pinecone_status() -> dict[str, Any]:
    return {
        "enabled": _enabled(),
        "index": settings.pinecone_index_name,
        "namespace": settings.pinecone_namespace,
    }
