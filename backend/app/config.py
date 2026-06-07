from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_URL = f"sqlite:///{BACKEND_DIR / 'course_reviews.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = DEFAULT_SQLITE_URL
    environment: str = "local"
    use_mock_ml: bool = True
    ml_provider: str = "groq"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout_sec: int = 90
    ollama_live_reviews_only: bool = True
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.1-8b-instant"
    groq_timeout_sec: int = 60
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    openai_timeout_sec: int = 60
    enable_bigquery: bool = False
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5174"

    auth_required: bool = True
    firebase_project_id: str = "course-review-explorer-demo"
    firebase_auth_emulator_host: str = ""
    firebase_credentials_path: str = ""
    auth_dev_token: str = "local-dev-verifier-token"

    gcp_project: str = ""
    gcp_region: str = "us-central1"
    vertex_model: str = "gemini-2.5-flash"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_sec: int = 60
    bigquery_dataset: str = "course_reviews_dataset"
    bigquery_table: str = "reviews_analytics"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
