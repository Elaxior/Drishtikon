import os

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


def _env_int(name: str, default: int, min_value: int, max_value: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except ValueError:
        value = default

    return max(min_value, min(max_value, value))


def _env_float(name: str, default: float, min_value: float, max_value: float) -> float:
    raw_value = os.getenv(name, str(default))
    try:
        value = float(raw_value)
    except ValueError:
        value = default

    return max(min_value, min(max_value, value))


def _env_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _env_choice(name: str, default: str, allowed: set[str]) -> str:
    raw_value = os.getenv(name, default)
    normalized = raw_value.strip().lower()
    if normalized in allowed:
        return normalized
    return default


class Settings(BaseModel):
    app_name: str = "drishtikon API"
    app_version: str = "0.2.0"
    frontend_origin: str = "http://localhost:5173"

    # NewsData.io
    newsdata_api_key: str | None = None
    newsdata_base_url: str = "https://newsdata.io/api/1"
    newsdata_timeout_seconds: int = 10
    newsdata_page_size: int = 10

    # GNews.io  (100 req/day free)
    gnews_api_key: str | None = None

    # Currents API  (600 req/day free)
    currents_api_key: str | None = None

    # NewsAPI.org (can target India via country=in)
    newsapi_api_key: str | None = None

    # Groq LLM
    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"

    # Supadata (optional social media extraction)
    supadata_api_key: str | None = None
    supadata_base_url: str = "https://api.supadata.ai/v1"
    supadata_timeout_seconds: int = 20
    supadata_poll_retries: int = 6
    supadata_transcript_mode: str = "native"

    # Processing limits
    enable_search_cache: bool = True
    search_cache_ttl_seconds: int = 180
    claim_extraction_workers: int = 4
    claims_article_limit: int = 8
    analysis_article_limit: int = 15
    search_size_per_provider: int = 16
    consensus_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    warmup_embeddings_on_startup: bool = True
    require_full_spectrum: bool = False
    consensus_similarity_threshold: float = 0.75
    consensus_claims_per_article: int = 3

    # Pinecone (optional)
    enable_pinecone: bool = False
    pinecone_api_key: str | None = None
    pinecone_index_name: str = "drishtikon-claims"
    pinecone_namespace: str = "claims"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"
    pinecone_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    pinecone_embedding_dimension: int = 384
    pinecone_top_k: int = 5
    pinecone_match_threshold: float = 0.82
    pinecone_query_claim_limit: int = 8


settings = Settings(
    frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    newsdata_api_key=os.getenv("NEWSDATA_API_KEY"),
    newsdata_base_url=os.getenv("NEWSDATA_BASE_URL", "https://newsdata.io/api/1"),
    newsdata_timeout_seconds=_env_int("NEWSDATA_TIMEOUT_SECONDS", 10, 3, 60),
    newsdata_page_size=_env_int("NEWSDATA_PAGE_SIZE", 10, 1, 12),
    gnews_api_key=os.getenv("GNEWS_API_KEY"),
    currents_api_key=os.getenv("CURRENTS_API_KEY"),
    newsapi_api_key=os.getenv("NEWSAPI_API_KEY"),
    groq_api_key=os.getenv("GROQ_API_KEY"),
    groq_model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
    supadata_api_key=os.getenv("SUPADATA_API_KEY"),
    supadata_base_url=os.getenv("SUPADATA_BASE_URL", "https://api.supadata.ai/v1"),
    supadata_timeout_seconds=_env_int("SUPADATA_TIMEOUT_SECONDS", 20, 5, 60),
    supadata_poll_retries=_env_int("SUPADATA_POLL_RETRIES", 6, 1, 20),
    supadata_transcript_mode=_env_choice("SUPADATA_TRANSCRIPT_MODE", "native", {"native", "auto", "generate"}),
    enable_search_cache=_env_bool("ENABLE_SEARCH_CACHE", True),
    search_cache_ttl_seconds=_env_int("SEARCH_CACHE_TTL_SECONDS", 180, 0, 1800),
    claim_extraction_workers=_env_int("CLAIM_EXTRACTION_WORKERS", 4, 1, 8),
    claims_article_limit=_env_int("CLAIMS_ARTICLE_LIMIT", 8, 1, 15),
    analysis_article_limit=_env_int("ANALYSIS_ARTICLE_LIMIT", 15, 3, 30),
    search_size_per_provider=_env_int("SEARCH_SIZE_PER_PROVIDER", 16, 5, 20),
    consensus_embedding_model=os.getenv(
        "CONSENSUS_EMBEDDING_MODEL",
        os.getenv("PINECONE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
    ),
    warmup_embeddings_on_startup=_env_bool("WARMUP_EMBEDDINGS_ON_STARTUP", True),
    require_full_spectrum=_env_bool("REQUIRE_FULL_SPECTRUM", False),
    consensus_similarity_threshold=_env_float("CONSENSUS_SIMILARITY_THRESHOLD", 0.75, 0.5, 0.95),
    consensus_claims_per_article=_env_int("CONSENSUS_CLAIMS_PER_ARTICLE", 3, 1, 3),
    enable_pinecone=_env_bool("ENABLE_PINECONE", False),
    pinecone_api_key=os.getenv("PINECONE_API_KEY"),
    pinecone_index_name=os.getenv("PINECONE_INDEX_NAME", "drishtikon-claims"),
    pinecone_namespace=os.getenv("PINECONE_NAMESPACE", "claims"),
    pinecone_cloud=os.getenv("PINECONE_CLOUD", "aws"),
    pinecone_region=os.getenv("PINECONE_REGION", "us-east-1"),
    pinecone_embedding_model=os.getenv("PINECONE_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
    pinecone_embedding_dimension=_env_int("PINECONE_EMBEDDING_DIMENSION", 384, 64, 4096),
    pinecone_top_k=_env_int("PINECONE_TOP_K", 5, 1, 20),
    pinecone_match_threshold=_env_float("PINECONE_MATCH_THRESHOLD", 0.82, 0.5, 0.99),
    pinecone_query_claim_limit=_env_int("PINECONE_QUERY_CLAIM_LIMIT", 8, 1, 20),
)
