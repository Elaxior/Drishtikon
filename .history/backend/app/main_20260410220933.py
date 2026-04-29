import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.admin import router as admin_router
from app.routes.health import router as health_router
from app.routes.search import router as search_router
from app.routes.trending import router as trending_router
from app.services.embeddings import get_embedding_model

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(search_router)
app.include_router(trending_router)
app.include_router(admin_router)


def _models_to_warm() -> list[str]:
    candidates = [settings.consensus_embedding_model]
    if settings.enable_pinecone:
        candidates.append(settings.pinecone_embedding_model)

    unique_models: list[str] = []
    seen: set[str] = set()
    for model_name in candidates:
        normalized_name = model_name.strip()
        if not normalized_name or normalized_name in seen:
            continue
        seen.add(normalized_name)
        unique_models.append(normalized_name)

    return unique_models


@app.on_event("startup")
def warmup_embeddings() -> None:
    if not settings.warmup_embeddings_on_startup:
        logger.info("Embedding warmup is disabled by WARMUP_EMBEDDINGS_ON_STARTUP.")
        return

    models = _models_to_warm()
    if not models:
        return

    logger.info("Warming %d embedding model(s) at startup.", len(models))
    for model_name in models:
        try:
            get_embedding_model(model_name)
            logger.info("Embedding model warmed: %s", model_name)
        except Exception as exc:
            logger.warning("Failed to warm embedding model %s: %s", model_name, exc)
