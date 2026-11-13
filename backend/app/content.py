"""Contenus éditables : content/*.json (défauts) + surcharge admin stockée en base."""
import json
import re
import time
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


# ---------------- Textes et glossaire (content/*.json + surcharge admin en base) ----------------
_TEXTS_KEY, _GLOSS_KEY = "content:texts", "content:glossary"
_GLOSS_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")
_version = int(time.time())


def version() -> int:
    """Change à chaque modification : les clients rechargent alors les textes."""
    return _version


def bump() -> None:
    global _version
    _version = max(_version + 1, int(time.time()))


def _file(name: str) -> dict:
    return json.loads((settings.content_path() / name).read_text("utf-8"))


def _txt(v, label: str, *, empty_ok: bool = False, limit: int = 1500) -> str:
    if not isinstance(v, str):
        raise schema.SchemaError(f"{label} : texte attendu")
    v = v.strip()
    if (not v and not empty_ok) or len(v) > limit:
        raise schema.SchemaError(f"{label} : entre 1 et {limit} caractères")
    return v


def _check_text(default, value):
    if isinstance(default, dict):  # variantes curieux / expert
        if not isinstance(value, dict):
            raise schema.SchemaError("Deux versions attendues (curieux et expert)")
        return {k: _txt(value.get(k), k) for k in ("curious", "expert")}
    return _txt(value, "texte")


def get_texts() -> dict:
    defaults, out = _file("texts.json"), {}
    over = db.kv_get(_TEXTS_KEY, {})
    for k, d in defaults.items():
        try:
            out[k] = _check_text(d, over[k]) if k in over else d
        except schema.SchemaError:
            out[k] = d
    return out


def text_rows() -> list[dict]:
    over = db.kv_get(_TEXTS_KEY, {})
    cur = get_texts()
    return [{"key": k, "default": d, "value": cur[k], "overridden": k in over}
            for k, d in _file("texts.json").items()]


def set_text(key: str, value) -> None:
    defaults = _file("texts.json")
    if key not in defaults:
        raise schema.SchemaError("Texte inconnu")
    over = db.kv_get(_TEXTS_KEY, {})
    over[key] = _check_text(defaults[key], value)
    db.kv_set(_TEXTS_KEY, over)
    bump()


def reset_text(key: str) -> None:
    over = db.kv_get(_TEXTS_KEY, {})
    over.pop(key, None)
    db.kv_set(_TEXTS_KEY, over)
    bump()


def _check_term(value) -> dict:
    if not isinstance(value, dict):
        raise schema.SchemaError("Terme invalide")
    return {"label": _txt(value.get("label"), "Mot", limit=60),
            "simple": _txt(value.get("simple"), "Explication simple", limit=400),
            "expert": _txt(value.get("expert", ""), "Explication expert", empty_ok=True, limit=600)}


def get_glossary() -> dict:
    out = dict(_file("glossary.json"))
    for k, v in db.kv_get(_GLOSS_KEY, {}).items():
        try:
            out[k] = _check_term(v)
        except schema.SchemaError:
            pass
    return out


def glossary_rows() -> list[dict]:
    defaults, over, cur = _file("glossary.json"), db.kv_get(_GLOSS_KEY, {}), get_glossary()
    return [{"key": k, "default": defaults.get(k), "value": v, "overridden": k in over, "custom": k not in defaults}
            for k, v in sorted(cur.items())]


def set_glossary(key: str, value) -> None:
    if not _GLOSS_RE.match(key):
        raise schema.SchemaError("Identifiant : minuscules, chiffres et tirets")
    over = db.kv_get(_GLOSS_KEY, {})
    over[key] = _check_term(value)
    db.kv_set(_GLOSS_KEY, over)
    bump()


def reset_glossary(key: str) -> None:
    over = db.kv_get(_GLOSS_KEY, {})
    over.pop(key, None)
    db.kv_set(_GLOSS_KEY, over)
    bump()
