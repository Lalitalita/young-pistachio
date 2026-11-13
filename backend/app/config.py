"""Configuration lue depuis l'environnement (.env via docker compose)."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET = "change-moi-par-une-longue-valeur-aleatoire"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    admin_password: str = "change-moi"
    secret_key: str = DEFAULT_SECRET
    pc_ip: str = "192.168.1.50"
    parcours_host: str = "parcours.cyber"
    http_port: int = 80
    wifi_ssid: str = ""
    wifi_password: str = ""
    wifi_security: str = "WPA"
    pi_ip: str = ""
    data_dir: str = "/data"
    static_dir: str = "/app/static"
    content_dir: str = ""

    def content_path(self) -> Path:
        for c in (self.content_dir, "/app/content", str(Path(__file__).resolve().parents[2] / "content")):
            if c and Path(c).is_dir():
                return Path(c)
        raise RuntimeError("dossier content/ introuvable")


settings = Settings()
