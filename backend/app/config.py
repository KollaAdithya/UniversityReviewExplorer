from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_URL = f"sqlite:///{BACKEND_DIR / 'course_reviews.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = DEFAULT_SQLITE_URL
    environment: str = "local"
    use_mock_ml: bool = True
    enable_bigquery: bool = False
    cors_origins: str = "http://localhost:5173"

    gcp_project: str = ""
    gcp_region: str = "us-central1"
    vertex_model: str = "gemini-2.0-flash"
    bigquery_dataset: str = "course_reviews_dataset"
    bigquery_table: str = "reviews_analytics"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
