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


class Settings(BaseModel):
    app_name: str = "Drishtikon API"
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

    # Processing limits
    claims_article_limit: int = 8
    analysis_article_limit: int = 12
    search_size_per_provider: int = 12
    require_full_spectrum: bool = False
    consensus_similarity_threshold: float = 0.75
    consensus_claims_per_article: int = 3


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
    claims_article_limit=_env_int("CLAIMS_ARTICLE_LIMIT", 8, 1, 15),
    analysis_article_limit=_env_int("ANALYSIS_ARTICLE_LIMIT", 12, 3, 30),
    search_size_per_provider=_env_int("SEARCH_SIZE_PER_PROVIDER", 12, 5, 20),
    require_full_spectrum=_env_bool("REQUIRE_FULL_SPECTRUM", False),
    consensus_similarity_threshold=_env_float("CONSENSUS_SIMILARITY_THRESHOLD", 0.75, 0.5, 0.95),
    consensus_claims_per_article=_env_int("CONSENSUS_CLAIMS_PER_ARTICLE", 3, 1, 3),
)
