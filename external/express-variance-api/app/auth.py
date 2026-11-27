from fastapi import Header, HTTPException

from app.config import get_settings


def require_bearer(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ", 1)[1].strip()
    expected = get_settings().variance_api_token
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")
