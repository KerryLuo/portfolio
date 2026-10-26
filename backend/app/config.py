from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    frontend_origin: str = "http://localhost:5173,https://kerryluo.github.io"

    resend_api_key: str = ""
    contact_to_email: str = ""
    contact_from_email: str = "Portfolio <onboarding@resend.dev>"

    github_username: str = "KerryLuo"
    github_token: str = ""

    @property
    def production(self) -> bool:
        return self.environment == "production"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]


settings = Settings()
