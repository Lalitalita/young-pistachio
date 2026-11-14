import asyncio
import random

import pytest

from app import boss as bossmod, chaos, db, phase3, supervision
from conftest import cookie_header


class Clock:
    def __init__(self, t=1000.0):
        self.t = t

    def __call__(self):
        return self.t


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


# ---------------- incidents ----------------

def test_incident_content_is_consistent():
    incs = phase3.incidents()
    assert len(incs) >= 6
    for i in incs:
        assert i["answer"] == 0 and len(i["choices"]) == 3 and len(i["clues"]) == 3
        assert {"curious", "expert"} <= set(i["title"])
    assert len({i["id"] for i in incs}) == len(incs)


def test_score_formula():
    assert phase3.compute_score(10, 0, 0) == 100
    assert phase3.compute_score(10, 3, 0) == 64
    assert phase3.compute_score(10, 0, 2) == 70
    assert phase3.compute_score(30 + 4 * 25, 0, 0) == 75  # pénalité de lenteur plafonnée
    assert phase3.compute_score(9999, 3, 3) == phase3.MIN_SCORE


@pytest.fixture
def sessions(tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    db.init_db()
    clock = Clock()
    return phase3.Sessions(random.Random(1), clock), clock


def test_view_never_leaks_answer_or_unrevealed_clues(sessions):
    s, _ = sessions
    v = s.view("a")
    assert "answer" not in str(v).lower().replace("answered", "")
    assert v["clues"] == [] and v["clue_total"] == 3
    assert "fix" not in v and "lesson" not in v
    assert sorted(c["id"] for c in v["choices"]) == [0, 1, 2]  # ids = index d'origine, mélangés


def test_clues_cost_points_and_are_counted_once(sessions):
    s, clock = sessions
    s.view("a")
    assert s.clue("a", 0) and s.clue("a", 0) and s.clue("a", 1)
    assert not s.clue("a", 7)
    res = s.diagnose("a", 0, "Renard")
    assert res["correct"] and res["score"] == 100 - 2 * phase3.CLUE_COST


def test_wrong_answers_then_correct(sessions):
    s, clock = sessions
    s.view("a")
    assert s.diagnose("a", 1, "R") == {"correct": False, "wrong_count": 1}
    assert s.diagnose("a", 1, "R")["wrong_count"] == 1  # même mauvais choix : pas de double peine
    assert s.diagnose("a", 2, "R")["wrong_count"] == 2
    clock.t += 5
    res = s.diagnose("a", 0, "R")
    assert res["correct"] and res["score"] == 100 - 2 * phase3.WRONG_COST and res["elapsed"] == 5
    v = s.view("a")
    assert v["done"] and "fix" in v and "lesson" in v and s.has_solved("a")
    assert s.diagnose("a", 0, "R").get("ignored")  # une fois résolu : plus rien ne compte


def test_next_requires_solved_and_changes_scenario(sessions):
    s, _ = sessions
    first = s.view("a")["id"]
    assert s.next("a") is s.cur["a"] and s.view("a")["id"] == first  # pas de saut tant que non résolu
    s.diagnose("a", 0, "R")
    s.next("a")
    assert s.view("a")["id"] != first and not s.view("a")["done"]
    assert s.view("a")["solved_count"] == 1


def test_public_stats_hide_moderated_and_are_anonymous(sessions):
    s, clock = sessions
    for vid, pseudo, clues in (("a", "Renard", 0), ("b", "Loutre", 2), ("c", "Caché", 0)):
        s.view(vid)
        for i in range(clues):
            s.clue(vid, i)
        clock.t += 3
        s.diagnose(vid, 0, pseudo)
    st = phase3.public_stats({"c"})
    assert st["solved"] == 2 and [t["pseudo"] for t in st["top"]] == ["Renard", "Loutre"]
    assert "Caché" not in str(st) and "visitor_id" not in str(st)


# ---------------- boss ----------------

class FakeChaos:
    def __init__(self):
        self.calls, self.fail = [], False

    def __call__(self, svc, act):
        if self.fail:
            raise chaos.ChaosError("injoignable")
        self.calls.append((svc, act))


PARAMS = {"boss_enabled": True, "boss_cooldown_s": 60, "boss_vote_s": 30, "boss_real": True}


def make_boss():
    clock, fake, mon = Clock(), FakeChaos(), supervision.Monitor()
    return bossmod.Boss(mon, clock, random.Random(2), fake), clock, fake, mon


def test_boss_full_cycle():
    b, clock, fake, mon = make_boss()
    assert run(b.start(PARAMS, "Renard", "demo-db")) is None
    assert fake.calls == [("demo-db", "stop")] and b.status == "voting"
    assert b.vote("v1", 0) and b.vote("v2", 1) and not b.vote("v1", 2)  # un seul vote chacun
    assert not b.vote("v3", 9)
    assert b.public()["votes"] == [1, 1, 0]
    clock.t += 31
    assert run(b.tick(PARAMS)) and b.status == "recovering"
    assert fake.calls[-1] == ("demo-db", "start") and b.result["pct"] == 50
    assert not b.vote("v3", 0)
    clock.t += 3
    assert not run(b.tick(PARAMS))                      # le service n'est pas encore revenu
    mon.status["demo-db"]["status"] = "up"
    clock.t += bossmod.RESULT_MIN_S
    assert run(b.tick(PARAMS)) and b.status == "idle"
    assert b.public()["cooldown_s"] > 0


def test_boss_cooldown_queue_and_priority():
    b, clock, fake, mon = make_boss()
    r1 = run(b.request("v1", "Renard", PARAMS))
    assert r1 == {"state": "started"}
    assert run(b.request("v2", "Loutre", PARAMS)) == {"state": "queued", "position": 1}
    assert run(b.request("v2", "Loutre", PARAMS)) == {"state": "queued", "position": 1}  # pas de doublon
    assert run(b.request("v3", "Lynx", PARAMS)) == {"state": "queued", "position": 2}
    clock.t += 31
    run(b.tick(PARAMS))
    mon.status[b.target]["status"] = "up"
    clock.t += 10
    run(b.tick(PARAMS))
    assert b.status == "idle" and len(b.queue) == 2
    assert run(b.tick(PARAMS)) is False                  # délai pas écoulé
    clock.t += 61
    assert run(b.tick(PARAMS)) and b.status == "voting" and b.by == "Loutre" and len(b.queue) == 1


def test_boss_disabled_and_force():
    b, *_ = make_boss()
    off = {**PARAMS, "boss_enabled": False}
    assert run(b.request("v1", "R", off)) == {"state": "disabled"}
    assert run(b.start(off, "x")) == "disabled"
    assert run(b.start(off, "animateur", force=True)) is None  # l'admin peut toujours déclencher
    assert run(b.start(PARAMS, "x", force=True)) == "busy"


def test_boss_agent_failure_keeps_idle():
    b, _, fake, _ = make_boss()
    fake.fail = True
    assert run(b.start(PARAMS, "x")) == "agent"
    assert b.status == "idle" and "injoignable" in b.last_error


def test_boss_simulated_mode_never_touches_docker():
    b, clock, fake, mon = make_boss()
    sim = {**PARAMS, "boss_real": False}
    run(b.start(sim, "x", "demo-web"))
    assert fake.calls == [] and "demo-web" in mon.forced_down
    mon.set_status("demo-web", "up", 1)               # une sonde « verte » est écrasée par la panne simulée
    assert mon.status["demo-web"]["status"] == "down"
    clock.t += 31
    run(b.tick(sim))
    assert "demo-web" not in mon.forced_down and fake.calls == []


def test_boss_recovery_timeout_forces_idle():
    b, clock, fake, mon = make_boss()
    run(b.start(PARAMS, "x", "demo-api"))
    clock.t += 31
    run(b.tick(PARAMS))
    clock.t += bossmod.RECOVER_MAX_S
    assert run(b.tick(PARAMS)) and b.status == "idle"


def test_restore_all_starts_everything():
    b, _, fake, mon = make_boss()
    run(b.start({**PARAMS, "boss_real": False}, "x", "demo-db"))
    assert run(b.restore_all()) == [] and b.status == "idle" and not mon.forced_down
    assert sorted(fake.calls) == [("demo-api", "start"), ("demo-db", "start"), ("demo-web", "start")]


def test_chaos_client_refuses_unknown():
    with pytest.raises(chaos.ChaosError):
        chaos.action("pihole", "stop")
    with pytest.raises(chaos.ChaosError):
        chaos.action("demo-web", "kill")


# ---------------- supervision ----------------

def test_monitor_events_and_pi_hysteresis(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "pi_ip", "10.0.0.5")
    mon = supervision.Monitor()
    mon.set_status("demo-web", "up", 3.2)
    mon.set_status("demo-web", "down", None)
    mon.set_status("demo-web", "up", 2)
    assert [e["level"] for e in mon.events] == ["ok", "bad"]
    monkeypatch.setattr(supervision, "probe_container", lambda sid: ("up", 1.0))
    monkeypatch.setattr(supervision, "probe_dns", lambda: ("up", 1.0))
    answers = iter([(True, 1.0), (False, None), (False, None), (True, 1.0)])
    monkeypatch.setattr(supervision, "probe_pi", lambda ip: next(answers))
    states = []
    for _ in range(4):
        run(mon.refresh())
        states.append(mon.status["pi"]["status"])
    assert states == ["up", "up", "down", "up"]  # 1 échec isolé ne suffit pas à déclarer le Pi coupé
    assert any("serveur physique" in e["text"] for e in mon.events)


def test_pi_probe_tcp_fallback(monkeypatch):
    monkeypatch.setattr(supervision, "_icmp", lambda ip: (None, None))
    monkeypatch.setattr(supervision, "_tcp", lambda h, p, t=1: ("refused" if p == 80 else "down", 2.0))
    assert supervision.probe_pi("10.0.0.5") == (True, 2.0)       # « refusé » = la machine est vivante
    monkeypatch.setattr(supervision, "_tcp", lambda h, p, t=1: ("down", None))
    assert supervision.probe_pi("10.0.0.5") == (False, None)
    monkeypatch.setattr(supervision, "_icmp", lambda ip: (True, 0.7))
    assert supervision.probe_pi("10.0.0.5") == (True, 0.7)       # ICMP prioritaire


def test_pi_not_configured_is_unknown(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "pi_ip", "")
    pi = [s for s in supervision.Monitor().public()["services"] if s["id"] == "pi"][0]
    assert pi["status"] == "unknown"


# ---------------- API ----------------

def test_api_incident_flow(client):
    assert client.get("/api/phase3/incident").status_code == 401
    client.post("/api/session")
    inc = client.get("/api/phase3/incident").json()
    assert inc["clues"] == [] and len(inc["choices"]) == 3
    assert client.post("/api/phase3/clue", json={"index": 1}).json()["clues"][0]["index"] == 1
    assert client.post("/api/phase3/clue", json={"index": 99}).status_code == 422
    # le boss est verrouillé tant que l'incident n'est pas réparé
    assert client.post("/api/phase3/boss/request").status_code == 403
    wrong = client.post("/api/phase3/diagnose", json={"choice": 1}).json()
    assert wrong["correct"] is False
    ok = client.post("/api/phase3/diagnose", json={"choice": 0}).json()
    assert ok["correct"] and ok["incident"]["done"] and ok["incident"]["fix"]
    st = client.get("/api/state").json()["p3"]
    assert st["stats"]["solved"] == 1
    assert {s["id"] for s in st["services"]} >= {"demo-web", "demo-api", "demo-db", "pi"}
    nxt = client.post("/api/phase3/next").json()
    assert nxt["id"] != inc["id"] and not nxt["done"]


def test_api_boss_request_and_vote_simulated(admin, client):
    client.post("/api/session")
    admin.put("/api/admin/phases/p3/params", json={"values": {"boss_real": False, "boss_vote_s": 15}})
    client.post("/api/phase3/diagnose", json={"choice": 0})
    r = client.post("/api/phase3/boss/request").json()
    assert r == {"state": "started"}
    boss = client.get("/api/state").json()["p3"]["boss"]
    assert boss["status"] == "voting" and boss["real"] is False
    assert client.post("/api/phase3/boss/vote", json={"choice": 0}).json() == {"ok": True}
    assert client.post("/api/phase3/boss/vote", json={"choice": 1}).json() == {"ok": False}
    assert client.get("/api/state").json()["p3"]["boss"]["votes"] == [1, 0, 0]
    assert admin.post("/api/admin/phase3/boss", json={}).status_code == 409
    assert admin.post("/api/admin/phase3/restore").status_code == 200  # chaos-agent absent : erreurs listées, état remis
    assert client.get("/api/state").json()["p3"]["boss"]["status"] == "idle"


def test_admin_endpoints_require_login(client):
    for m, u in (("post", "/api/admin/phase3/boss"), ("post", "/api/admin/phase3/restore"),
                 ("get", "/api/admin/phase3/agent"), ("delete", "/api/admin/phase3/queue")):
        assert getattr(client, m)(u).status_code == 401


def test_admin_boss_agent_unreachable_gives_502(admin):
    r = admin.post("/api/admin/phase3/boss", json={"target": "demo-web"})
    assert r.status_code == 502
    assert admin.get("/api/admin/phase3/agent").json()["ok"] is False
