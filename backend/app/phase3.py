"""Phase 3 (incidents individuels) : un scénario tiré au hasard par visiteur.

La bonne réponse ne quitte jamais le serveur : le téléphone reçoit les choix mélangés
(par identifiant) et le serveur valide. Les indices sont comptés côté serveur (ils coûtent des points).
"""
import json
import random
import time
from functools import lru_cache

from . import db
from .config import settings

CLUE_COST, WRONG_COST, SLOW_AFTER_S, SLOW_MAX = 12, 15, 30, 25
MIN_SCORE = 10


@lru_cache(maxsize=1)
def _data() -> dict:
    return json.loads((settings.content_path() / "incidents.json").read_text("utf-8"))


def incidents() -> list[dict]:
    return _data()["incidents"]


def boss_content() -> dict:
    return _data()["boss"]


def compute_score(elapsed_s: float, clues: int, wrong: int) -> int:
    slow = min(SLOW_MAX, max(0, int((elapsed_s - SLOW_AFTER_S) // 4)))
    return max(MIN_SCORE, 100 - CLUE_COST * clues - WRONG_COST * wrong - slow)


class Sessions:
    """État des incidents en mémoire (une partie en cours par visiteur) + compteurs."""

    def __init__(self, rng: random.Random | None = None, clock=time.time) -> None:
        self.rng, self.clock = rng or random.Random(), clock
        self.cur: dict[str, dict] = {}
        self.solved: dict[str, int] = {}  # nombre d'incidents résolus par visiteur

    def forget(self, vid: str) -> None:
        self.cur.pop(vid, None)
        self.solved.pop(vid, None)

    def clear(self) -> None:
        self.cur.clear()
        self.solved.clear()

    def has_solved(self, vid: str) -> bool:
        return self.solved.get(vid, 0) > 0

    def _new(self, vid: str, avoid: str | None) -> dict:
        pool = [i for i in incidents() if i["id"] != avoid] or incidents()
        inc = self.rng.choice(pool)
        order = list(range(len(inc["choices"])))
        self.rng.shuffle(order)
        s = {"incident": inc["id"], "order": order, "started": self.clock(), "clues": [], "wrong": [],
             "done": False, "score": None, "elapsed": None}
        self.cur[vid] = s
        return s

    def get(self, vid: str) -> dict:
        return self.cur.get(vid) or self._new(vid, None)

    def next(self, vid: str) -> dict:
        """Nouvel incident (différent du précédent) ; refusé tant que l'actuel n'est pas résolu."""
        s = self.cur.get(vid)
        if s and not s["done"]:
            return s
        return self._new(vid, s["incident"] if s else None)

    def restart_current(self, vid: str) -> dict:
        """Abandon : on repart sur un autre scénario (compte comme une nouvelle partie)."""
        s = self.cur.get(vid)
        return self._new(vid, s["incident"] if s else None)

    def _inc(self, s: dict) -> dict:
        return next(i for i in incidents() if i["id"] == s["incident"])

    def view(self, vid: str) -> dict:
        s = self.get(vid)
        inc = self._inc(s)
        out = {
            "id": inc["id"], "icon": inc["icon"], "title": inc["title"], "symptom": inc["symptom"],
            "clue_total": len(inc["clues"]),
            "clues": [{"index": i, "kind": inc["clues"][i]["kind"], "label": inc["clues"][i]["label"],
                       "text": inc["clues"][i]["text"]} for i in s["clues"]],
            "clue_labels": [{"index": i, "kind": c["kind"], "label": c["label"]} for i, c in enumerate(inc["clues"])],
            "choices": [{"id": n, "text": inc["choices"][n]} for n in s["order"]],
            "wrong": list(s["wrong"]), "done": s["done"], "score": s["score"], "elapsed": s["elapsed"],
            "started_at": s["started"], "solved_count": self.solved.get(vid, 0),
        }
        if s["done"]:
            out["fix"], out["lesson"] = inc["fix"], inc["lesson"]
        return out

    def clue(self, vid: str, index: int) -> bool:
        s = self.get(vid)
        inc = self._inc(s)
        if s["done"] or not 0 <= index < len(inc["clues"]):
            return False
        if index not in s["clues"]:
            s["clues"].append(index)
        return True

    def diagnose(self, vid: str, choice: int, pseudo: str) -> dict:
        """choice = index d'origine du choix (0 = bonne réponse dans le JSON)."""
        s = self.get(vid)
        inc = self._inc(s)
        if s["done"] or choice not in s["order"]:
            return {"correct": False, "ignored": True}
        if choice != inc["answer"]:
            if choice not in s["wrong"]:
                s["wrong"].append(choice)
            return {"correct": False, "wrong_count": len(s["wrong"])}
        s["done"] = True
        s["elapsed"] = round(self.clock() - s["started"], 1)
        s["score"] = compute_score(s["elapsed"], len(s["clues"]), len(s["wrong"]))
        self.solved[vid] = self.solved.get(vid, 0) + 1
        db.run("INSERT INTO scores(phase,visitor_id,value,data,created_at) VALUES('p3',?,?,?,?)",
               (vid, s["score"], json.dumps({"pseudo": pseudo, "incident": inc["id"], "elapsed": s["elapsed"],
                                             "clues": len(s["clues"]), "wrong": len(s["wrong"])}, ensure_ascii=False),
                self.clock()))
        return {"correct": True, "score": s["score"], "elapsed": s["elapsed"]}


def public_stats(hidden_visitor_ids: set[str]) -> dict:
    """Agrégats anonymes pour le grand écran."""
    rows = db.run("SELECT visitor_id,value,data,created_at FROM scores WHERE phase='p3' "
                  "ORDER BY created_at DESC LIMIT 300", fetch="all")
    items = [{**json.loads(r["data"]), "score": r["value"], "visitor_id": r["visitor_id"]} for r in rows]
    items = [i for i in items if i["visitor_id"] not in hidden_visitor_ids]
    best: dict[str, dict] = {}
    for i in items:
        if i["visitor_id"] not in best or i["score"] > best[i["visitor_id"]]["score"]:
            best[i["visitor_id"]] = i
    top = sorted(best.values(), key=lambda i: (-i["score"], i["elapsed"]))[:5]
    fastest = min(items, key=lambda i: i["elapsed"], default=None)
    by_incident: dict[str, int] = {}
    for i in items:
        by_incident[i["incident"]] = by_incident.get(i["incident"], 0) + 1
    return {
        "solved": len(items),
        "avg_elapsed": round(sum(i["elapsed"] for i in items) / len(items), 1) if items else None,
        "top": [{"pseudo": i["pseudo"], "score": round(i["score"])} for i in top],
        "fastest": {"pseudo": fastest["pseudo"], "elapsed": fastest["elapsed"]} if fastest else None,
        "feed": [{"pseudo": i["pseudo"], "incident": i["incident"], "score": round(i["score"])} for i in items[:6]],
        "by_incident": by_incident,
    }
