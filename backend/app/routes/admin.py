from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.services.news_aggregator import get_api_usage_stats

router = APIRouter(tags=["admin"])


def _require_admin_token(x_admin_token: str | None) -> None:
    expected = settings.admin_stats_token
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Admin dashboard token is not configured on the server.",
        )

    if not x_admin_token or x_admin_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/admin/api-usage")
def admin_api_usage(
    x_admin_token: str | None = Header(default=None, alias="x-admin-token"),
) -> dict[str, Any]:
    _require_admin_token(x_admin_token)
    return get_api_usage_stats()
