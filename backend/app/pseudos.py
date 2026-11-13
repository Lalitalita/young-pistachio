"""Pseudos aléatoires fun (« Renard Quantique »), accord en genre."""
import json
import random
from functools import lru_cache

from .config import settings


@lru_cache(maxsize=1)
def _lists() -> dict:
    return json.loads((settings.content_path() / "pseudos.json").read_text("utf-8"))


def generate(taken: set[str], rng: random.Random | None = None) -> str:
    rng = rng or random
    lists = _lists()
    p = ""
    for _ in range(40):
        a = rng.choice(lists["animals"])
        p = f"{a['n']} {rng.choice(lists['adjectives'])[a['g']]}"
        if p not in taken:
            return p
    return f"{p} {rng.randint(2, 99)}"
