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


class Settings(BaseModel):
    app_name: str = "Drishtikon API"
    app_version: str = "0.1.0"
    frontend_origin: str = "http://localhost:5173"
    newsdata_api_key: str | None = None
    newsdata_base_url: str = "https://newsdata.io/api/1"
    newsdata_timeout_seconds: int = 10
    newsdata_page_size: int = 10


settings = Settings(
    frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    newsdata_api_key=os.getenv("NEWSDATA_API_KEY"),
    newsdata_base_url=os.getenv("NEWSDATA_BASE_URL", "https://newsdata.io/api/1"),
    newsdata_timeout_seconds=_env_int("NEWSDATA_TIMEOUT_SECONDS", 10, 3, 60),
    newsdata_page_size=_env_int("NEWSDATA_PAGE_SIZE", 10, 1, 12),
)
