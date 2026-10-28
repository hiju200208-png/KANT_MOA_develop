from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore")

    database_url: str
    cors_origins: list[str] = ["http://localhost:3000"]
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    jwt_issuer: str = "kant-moa"
    google_client_id: str = ""
    google_cookie_secure: bool = True
    # 비밀번호 재설정: 메일 발송 없이 화면에 링크를 보여주는 시연 모드(기본 꺼짐)
    password_reset_demo: bool = False
    password_reset_expire_minutes: int = 15


@lru_cache
def get_settings() -> Settings:
    return Settings()
