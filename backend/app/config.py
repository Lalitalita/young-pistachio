"""Configuration lue depuis l'environnement (.env via docker compose)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    admin_password: str = "change-moi"
    secret_key: str = "change-moi-par-une-longue-valeur-aleatoire"
    pc_ip: str = "192.168.1.50"
    parcours_host: str = "parcours.cyber"
    http_port: int = 80
    wifi_ssid: str = ""
    wifi_password: str = ""
    wifi_security: str = "WPA"
    pi_ip: str = ""
    data_dir: str = "/data"
    static_dir: str = "/app/static"


settings = Settings()
