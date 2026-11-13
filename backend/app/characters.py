"""Fiches personnages fictives (introduction à l'OSINT, phase 1).

Générées une fois par visiteur et persistées (kv), pour rester identiques en cas de
reconnexion. Aucune donnée réelle : tout est tiré au hasard dans content/characters.json.
"""
import random
from datetime import date
from functools import lru_cache

from . import db
from .config import settings

PREFIX = "char:"


@lru_cache(maxsize=1)
def _lists() -> dict:
    import json

    return json.loads((settings.content_path() / "characters.json").read_text("utf-8"))


def _random_birthdate(rng: random.Random) -> str:
    year = rng.randint(date.today().year - 70, date.today().year - 16)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)  # évite les soucis de février/30-31
    return date(year, month, day).isoformat()


def generate() -> dict:
    rng = random.Random()
    lst = _lists()
    prenoms = lst["prenoms"]
    prenom, copain = rng.sample(prenoms, 2)
    return {
        "prenom": prenom, "nom": rng.choice(lst["noms"]), "naissance": _random_birthdate(rng),
        "ville": rng.choice(lst["villes"]), "animal": rng.choice(lst["animaux"]),
        "club": rng.choice(lst["clubs"]), "copain": copain,
    }


def get_or_create(vid: str) -> dict:
    fiche = db.kv_get(PREFIX + vid)
    if not fiche:
        fiche = generate()
        db.kv_set(PREFIX + vid, fiche)
    return fiche


def forget(vid: str) -> None:
    db.kv_delete(PREFIX + vid)
