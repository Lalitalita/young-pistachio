"""Contenus éditables : content/*.json (défauts) + surcharge admin stockée en base."""
import json
from pathlib import Path

from . import db, schema
from .config import settings

BRANDING_SCHEMA = [
    {"key": "school_name", "label": "Nom de l'école", "type": "string", "default": "Coda"},
    {"key": "event_title", "label": "Titre de l'événement", "type": "string", "default": "Journée portes ouvertes"},
    {"key": "event_date", "label": "Date et horaires", "type": "string", "default": ""},
    {"key": "event_place", "label": "Lieu", "type": "string", "default": ""},
    {"key": "next_workshop", "label": "Nom de l'atelier suivant", "type": "string", "default": "Atelier suivant"},
    {"key": "color_brand", "label": "Couleur principale (boutons, titres)", "type": "color", "default": "#ddf849"},
    {"key": "color_accent", "label": "Couleur d'accent", "type": "color", "default": "#6425f5"},
    {"key": "color_bg", "label": "Couleur de fond", "type": "color", "default": "#0a0a1f"},
    {"key": "formations", "label": "Formations (écran de fin)", "type": "list", "max_items": 6,
     "default": [], "fields": [
         {"key": "title", "label": "Intitulé", "type": "string", "default": ""},
         {"key": "level", "label": "Niveau", "type": "string", "default": ""},
         {"key": "description", "label": "Description", "type": "text", "default": "", "max": 300},
     ]},
]
_KEY = "content:branding"


def _file_defaults() -> dict:
    return json.loads((settings.content_path() / "branding.json").read_text("utf-8"))


def get_branding() -> dict:
    """Défauts JSON < surcharge admin (validée)."""
    merged = {**schema.defaults(BRANDING_SCHEMA), **_file_defaults(), **db.kv_get(_KEY, {})}
    return schema.validate(BRANDING_SCHEMA, merged)


def set_branding(values: dict) -> dict:
    clean = schema.validate(BRANDING_SCHEMA, values)
    db.kv_set(_KEY, clean)
    return clean


# --- Logo personnalisé (stocké dans /data) ---
LOGO_TYPES = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
LOGO_MAX = 600_000


def logo_path() -> Path:
    return Path(settings.data_dir) / "logo.bin"


def save_logo(data: bytes, content_type: str) -> None:
    if content_type not in LOGO_TYPES:
        raise schema.SchemaError("Format de logo non supporté (SVG, PNG, JPG, WEBP)")
    if not data or len(data) > LOGO_MAX:
        raise schema.SchemaError("Logo trop volumineux (600 Ko max)")
    if content_type == "image/svg+xml" and any(
        t in data.lower() for t in (b"<script", b"onload=", b"onerror=", b"javascript:")
    ):
        raise schema.SchemaError("SVG refusé (contenu actif)")
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    logo_path().write_bytes(data)
    db.kv_set("logo_type", content_type)


def delete_logo() -> None:
    logo_path().unlink(missing_ok=True)
    db.kv_delete("logo_type")


def logo_url() -> str:
    p = logo_path()
    return f"/api/logo?v={int(p.stat().st_mtime)}" if p.exists() else "/brand/coda-logo.svg"
