from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    express_db_path: str
    variance_api_token: str
    host: str = "127.0.0.1"
    port: int = 8090


@lru_cache
def get_settings() -> Settings:
    return Settings()
