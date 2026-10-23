import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.errors import ApiError, register_error_handlers


def test_errors_keep_team_contract_without_echoing_input():
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/quantity")
    def quantity(value: int):
        return value

    @app.get("/protected")
    def protected():
        raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")

    client = TestClient(app)
    invalid = client.get("/quantity", params={"value": "private-input"})
    assert invalid.status_code == 422
    assert set(invalid.json()) == {"code", "message"}
    assert "private-input" not in invalid.text
    denied = client.get("/protected")
    assert denied.status_code == 401
    assert denied.headers["www-authenticate"] == "Bearer"
    assert denied.json()["code"] == "NOT_AUTHENTICATED"
    assert client.get("/missing").json()["code"] == "UNKNOWN"


def test_app_docs_and_public_static_routes_without_database_lifespan():
    from main import app

    # This intentionally skips lifespan and is not a real database connectivity test.
    client = TestClient(app)
    assert client.get("/docs").status_code == 200
    assert "/health" in client.get("/openapi.json").json()["paths"]
    assert client.get("/static/missing.webp").status_code == 404
    assert client.get("/uploads/missing.webp").json()["code"] == "UNKNOWN"
    preflight = client.options("/health", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
    })
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:3000"
    denied = client.options("/health", headers={
        "Origin": "https://untrusted.example",
        "Access-Control-Request-Method": "GET",
    })
    assert "access-control-allow-origin" not in denied.headers
