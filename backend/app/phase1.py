"""Logique serveur de la phase 1 : stockage des résultats, records, pièges, support visiteur.

L'algorithme de robustesse tourne côté téléphone (client). Le serveur ne fait que
stocker le résultat (avec le mot de passe, pour le support en cas de retour du
visiteur) et purge automatiquement après la durée réglée dans l'admin.
"""
import json
import time

from . import db

PATTERN_CODES = {
    "prenom", "nom", "date_naissance", "ville", "animal", "club", "copain",
    "annee", "sequence_clavier", "leet", "repetition", "mot_commun", "schema_maj_annee",
}


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def save_submission(vid: str, pseudo: str, payload: dict) -> dict:
    patterns = [p for p in payload["patterns"] if p in PATTERN_CODES][:25]
    data = {
        "pseudo": pseudo, "password": payload["password"][:128], "length": payload["length"],
        "patterns": patterns, "times": payload["times"],
    }
    now = time.time()
    db.run("INSERT INTO scores(phase,visitor_id,value,data,created_at) VALUES('p1',?,?,?,?)",
           (vid, payload["score"], json.dumps(data, ensure_ascii=False), now))
    return {"saved_at": now}


def purge_expired(retention_min: int) -> int:
    cutoff = time.time() - retention_min * 60
    before = db.run("SELECT COUNT(*) n FROM scores WHERE phase='p1'", fetch="one")["n"]
    db.run("DELETE FROM scores WHERE phase='p1' AND created_at < ?", (cutoff,))
    after = db.run("SELECT COUNT(*) n FROM scores WHERE phase='p1'", fetch="one")["n"]
    return before - after


def _rows(limit: int = 300) -> list[dict]:
    rows = db.run("SELECT visitor_id,value,data,created_at FROM scores WHERE phase='p1' "
                  "ORDER BY created_at DESC LIMIT ?", (limit,), "all")
    return [{**json.loads(r["data"]), "visitor_id": r["visitor_id"], "value": r["value"],
             "created_at": r["created_at"]} for r in rows]


def public_stats(hidden_visitor_ids: set[str]) -> dict:
    """Agrégats anonymes pour le grand écran : jamais le mot de passe lui-même."""
    rows = [r for r in _rows() if r["visitor_id"] not in hidden_visitor_ids]
    strongest = max(rows, key=lambda r: r["value"], default=None)
    by_visitor: dict[str, list[dict]] = {}
    for r in rows:
        by_visitor.setdefault(r["visitor_id"], []).append(r)
    best_progress, best_delta = None, 0.0
    for attempts in by_visitor.values():
        attempts.sort(key=lambda r: r["created_at"])
        if len(attempts) < 2:
            continue
        delta = attempts[-1]["value"] - attempts[0]["value"]
        if delta > best_delta:
            best_delta, best_progress = delta, attempts[-1]
    pitfalls: dict[str, int] = {}
    for r in rows:
        for p in r["patterns"]:
            pitfalls[p] = pitfalls.get(p, 0) + 1
    total = len(rows) or 1
    top = sorted(pitfalls.items(), key=lambda kv: -kv[1])[:5]
    return {
        "count": len(rows),
        "strongest": ({"pseudo": strongest["pseudo"], "score": strongest["value"],
                       "offline_fast": strongest["times"]["offline_fast"]} if strongest else None),
        "best_progress": ({"pseudo": best_progress["pseudo"], "delta": round(best_delta)}
                          if best_progress else None),
        "top_pitfalls": [{"code": c, "pct": round(100 * n / total)} for c, n in top],
        "feed": [{"pseudo": r["pseudo"], "score": r["value"], "length": r["length"],
                  "offline_fast": r["times"]["offline_fast"]} for r in rows[:8]],
    }


def lookup(query: str) -> list[dict]:
    """Support : retrouver les derniers résultats d'un pseudo (admin uniquement)."""
    q = f"%{query.lower()}%"
    rows = db.run("SELECT visitor_id,value,data,created_at FROM scores WHERE phase='p1' "
                  "AND lower(json_extract(data,'$.pseudo')) LIKE ? ORDER BY created_at DESC LIMIT 20",
                  (q,), "all")
    return [{**json.loads(r["data"]), "score": r["value"], "created_at": r["created_at"]} for r in rows]
