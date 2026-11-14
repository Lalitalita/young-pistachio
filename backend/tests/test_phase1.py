import time

from app import characters, phase1
from conftest import cookie_header


def submit(client, password="x", score=50, length=1, patterns=None, times=None):
    body = {"password": password, "length": length, "score": score,
            "patterns": patterns or [], "times": times or {"online": 1, "offline_fast": 1, "gpu_farm": 1}}
    return client.post("/api/phase1/submit", json=body)


# ---------------- characters.py ----------------

def test_character_generation_is_well_formed():
    c = characters.generate()
    assert {"prenom", "nom", "naissance", "ville", "animal", "club", "copain"} <= set(c)
    assert c["prenom"] != c["copain"]
    year = int(c["naissance"][:4])
    from datetime import date
    assert date.today().year - 70 <= year <= date.today().year - 16


def test_character_persists_per_visitor(tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    from app import db

    db.init_db()
    c1 = characters.get_or_create("abc")
    c2 = characters.get_or_create("abc")
    assert c1 == c2
    characters.forget("abc")
    c3 = characters.get_or_create("abc")
    assert isinstance(c3, dict)  # régénérée, peut différer


# ---------------- API ----------------

def test_character_requires_session(client):
    assert client.get("/api/character").status_code == 401
    client.post("/api/session")
    c = client.get("/api/character").json()
    assert {"prenom", "nom", "naissance", "ville", "animal", "club", "copain"} <= set(c)
    assert client.get("/api/character").json() == c  # stable


def test_submit_requires_session_and_validates(client):
    assert submit(client).status_code == 401
    client.post("/api/session")
    assert submit(client).status_code == 200
    assert submit(client, score=150).status_code == 422
    assert submit(client, length=-1).status_code == 422
    assert client.post("/api/phase1/submit", json={"password": "x", "length": 1, "score": 1,
                                                    "patterns": [], "times": {"online": 1}}).status_code == 422
    assert submit(client, patterns=["prenom", "n_importe_quoi"]).status_code == 200  # code inconnu toléré


def test_submit_rate_limited(client):
    client.post("/api/session")
    codes = [submit(client).status_code for _ in range(32)]
    assert codes.count(429) >= 1


def test_submit_never_exposed_on_public_state(client):
    client.post("/api/session")
    submit(client, password="SECRET-TEST-1234")
    st = client.get("/api/state").json()
    # le mot de passe ne peut sortir que par le palmarès des plus faibles (score < 60), jamais ailleurs
    assert "SECRET-TEST-1234" not in str({k: v for k, v in st["p1"].items() if k != "weakest"})
    assert "SECRET-TEST-1234" not in str({k: v for k, v in st.items() if k != "p1"})
    assert st["p1"]["count"] == 1
    assert st["p1"]["strongest"]["score"] == 50
    assert st["p1"]["strongest"]["offline_fast"] == 1
    assert st["p1"]["feed"][0]["offline_fast"] == 1


def test_pitfalls_and_strongest_and_progress(admin, client):
    client.post("/api/session")
    submit(client, score=30, patterns=["prenom", "date_naissance"])
    client.post("/api/session/reroll")
    submit(client, score=80, patterns=["prenom"])
    time.sleep(0.05)
    submit(client, score=95, patterns=[])  # même visiteur, 2e tentative -> progression
    st = client.get("/api/state").json()["p1"]
    assert st["strongest"]["score"] == 95
    codes = {p["code"] for p in st["top_pitfalls"]}
    assert "prenom" in codes
    assert st["best_progress"] is not None and st["best_progress"]["delta"] > 0


def test_hidden_visitor_excluded_from_public_stats(admin, client):
    client.post("/api/session")
    submit(client, score=99)
    vid = admin.get("/api/admin/visitors").json()[0]["id"]
    admin.post(f"/api/admin/visitors/{vid}/hide", json={"hidden": True})
    assert admin.get("/api/state").json()["p1"]["count"] == 0


def test_admin_lookup_support(admin, client):
    client.post("/api/session")
    pseudo = client.get("/api/session").json()["pseudo"]
    submit(client, password="MotDePasseDeTest", score=42)
    assert admin.get("/api/admin/phase1/lookup?q=a").status_code == 422
    rows = admin.get(f"/api/admin/phase1/lookup?q={pseudo[:4]}").json()
    assert rows and rows[0]["password"] == "MotDePasseDeTest" and rows[0]["pseudo"] == pseudo


def test_purge_removes_old_submissions(admin, client):
    client.post("/api/session")
    submit(client, score=10)
    from app import db

    db.run("UPDATE scores SET created_at = created_at - 7200 WHERE phase='p1'")
    assert phase1.purge_expired(60) == 1
    assert client.get("/api/state").json()["p1"]["count"] == 0


def test_retention_configurable_and_reset_clears_characters(admin, client):
    assert admin.put("/api/admin/phases/p1/params", json={"values": {"data_retention_min": 5}}).status_code == 200
    assert admin.get("/api/state").json()["phases"][1]["params"]["data_retention_min"] == 5
    assert admin.put("/api/admin/phases/p1/params", json={"values": {"data_retention_min": 1}}).status_code == 422
    client.post("/api/session")
    client.get("/api/character")
    from app import db

    assert db.kv_get("char:" + admin.get("/api/admin/visitors").json()[0]["id"]) is not None
    admin.post("/api/admin/reset", json={"confirm": "RESET"})
    rows = db.run("SELECT key FROM kv WHERE key LIKE 'char:%'", fetch="all")
    assert rows == []


def test_weakest_ranking_is_anonymous_dedup_and_toggleable(admin, client):
    client.post("/api/session")
    for pw, score in (("azerty", 3), ("AZERTY", 3), ("lea1998", 10), ("Xq7#mK2!wZrT9", 95)):
        assert submit(client, password=pw, score=score, times={"online": 1, "offline_fast": 0.001, "gpu_farm": 1}).status_code == 200
    w = client.get("/api/state").json()["p1"]["weakest"]
    assert [e["password"].lower() for e in w] == ["azerty", "lea1998"]      # le fort est exclu, les doublons fusionnés
    assert w[0]["count"] == 2 and "pseudo" not in str(w) and "visitor" not in str(w)
    admin.put("/api/admin/phases/p1/params", json={"values": {"show_weak_passwords": False}})
    assert client.get("/api/state").json()["p1"]["weakest"] == []
    assert "Xq7#mK2" not in str(client.get("/api/state").json())
