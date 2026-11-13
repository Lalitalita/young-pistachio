"""Schémas de paramètres déclaratifs : validation serveur + génération des formulaires admin.

Un schéma = liste de champs {key,label,type,default,...}. Types : string, text, number,
boolean, color, select, list (avec `fields`).
"""
import re
from typing import Any

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class SchemaError(ValueError):
    pass


def defaults(schema: list[dict]) -> dict:
    out = {}
    for f in schema:
        d = f.get("default")
        out[f["key"]] = [dict(x) for x in d] if isinstance(d, list) else d
    return out


def _one(f: dict, v: Any) -> Any:
    label = f.get("label", f["key"])
    t = f["type"]
    if t in ("string", "text"):
        if not isinstance(v, str):
            raise SchemaError(f"{label} : texte attendu")
        v = v.strip()
        if len(v) > f.get("max", 200 if t == "string" else 2000):
            raise SchemaError(f"{label} : trop long")
        return v
    if t == "number":
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            raise SchemaError(f"{label} : nombre attendu")
        lo, hi = f.get("min", float("-inf")), f.get("max", float("inf"))
        if not lo <= v <= hi:
            raise SchemaError(f"{label} : doit être entre {lo} et {hi}")
        return int(v) if f.get("int") else v
    if t == "boolean":
        if not isinstance(v, bool):
            raise SchemaError(f"{label} : oui/non attendu")
        return v
    if t == "color":
        if not isinstance(v, str) or not COLOR_RE.match(v):
            raise SchemaError(f"{label} : couleur #rrggbb attendue")
        return v.lower()
    if t == "select":
        if v not in [o["value"] for o in f["options"]]:
            raise SchemaError(f"{label} : choix invalide")
        return v
    if t == "list":
        if not isinstance(v, list) or len(v) > f.get("max_items", 10):
            raise SchemaError(f"{label} : liste invalide")
        return [validate(f["fields"], item) for item in v if isinstance(item, dict)]
    raise SchemaError(f"type inconnu : {t}")


def validate(schema: list[dict], values: dict) -> dict:
    """Valide `values` ; les clés absentes prennent leur défaut, les inconnues sont ignorées."""
    if not isinstance(values, dict):
        raise SchemaError("objet attendu")
    out = {}
    for f in schema:
        out[f["key"]] = _one(f, values[f["key"]] if f["key"] in values else defaults([f])[f["key"]])
    return out
