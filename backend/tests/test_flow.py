import time

import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import cookie_header


def recv_state(ws, pred=lambda m: True, tries=20):
    for _ in range(tries):
        m = ws.receive_json()
        if m["type"] == "state" and pred(m):
            return m
    raise AssertionError("état attendu non reçu")


def test_session_cookie_httponly_and_idempotent(client):
    r = client.post("/api/session")
    assert r.status_code == 200 and r.json()["phase"] == "p0"
    sc = r.headers["set-cookie"].lower()
    assert "httponly" in sc and "samesite=lax" in sc and "secure" not in sc
    pseudo = r.json()["pseudo"]
    assert client.post("/api/session").json()["pseudo"] == pseudo
    assert client.get("/api/session").json()["pseudo"] == pseudo
    assert client.get("/api/state").json()["counts"]["day_total"] == 1


def test_no_session_without_cookie(client):
    assert client.get("/api/session").status_code == 401
    with client.websocket_connect("/api/ws/visitor") as ws:
        assert ws.receive_json()["type"] == "no_session"


def test_forged_cookie_rejected(client):
    client.cookies.set("cp_sid", "deadbeef.1.abc")
    assert client.get("/api/session").status_code == 401


def test_reroll_changes_pseudo(client):
    p1 = client.post("/api/session").json()["pseudo"]
    seen = {client.post("/api/session/reroll").json()["pseudo"] for _ in range(6)}
    assert len(seen) > 1 and any(p != p1 for p in seen)
    assert client.get("/api/session").json()["pseudo"] in seen


def test_admin_requires_password(client):
    assert client.get("/api/admin/me").status_code == 401
    assert client.put("/api/admin/progression", json={"mode": "guided"}).status_code == 401
    assert client.post("/api/admin/login", json={"password": "faux"}).status_code == 401
    r = client.post("/api/admin/login", json={"password": "test-admin"})
    assert r.status_code == 200 and "httponly" in r.headers["set-cookie"].lower()
    assert client.get("/api/admin/me").status_code == 200
    client.post("/api/admin/logout")
    assert client.get("/api/admin/me").status_code == 401


def test_login_rate_limited(client):
    codes = [client.post("/api/admin/login", json={"password": "x"}).status_code for _ in range(8)]
    assert codes[:6] == [401] * 6 and codes[-1] == 429


def test_admin_ws_rejected_without_cookie(client):
    with client.websocket_connect("/api/ws/admin") as ws:
        assert ws.receive_json()["type"] == "unauthorized"


def test_visitor_ws_and_broadcast_on_admin_change(client):
    client.post("/api/session")
    vh = cookie_header(client)
    client.cookies.clear()
    client.post("/api/admin/login", json={"password": "test-admin"})
    with client.websocket_connect("/api/ws/visitor", headers=vh) as ws:
        first = recv_state(ws)
        assert first["me"]["phase"] == "p0" and first["state"]["mode"] == "free"
        client.put("/api/admin/progression", json={"mode": "guided"})
        m = recv_state(ws, lambda m: m["state"]["mode"] == "guided")
        assert m["me"]["allowed"] == ["p0"]


def test_guided_lock_and_open_next(admin, client):
    s = client.post("/api/session")
    vh = cookie_header(client)
    admin.put("/api/admin/progression", json={"mode": "guided"})
    with client.websocket_connect("/api/ws/visitor", headers=vh) as ws:
        recv_state(ws)
        ws.send_json({"type": "advance"})
        time.sleep(0.4)
        assert client.get("/api/session").json()["phase"] == "p0"  # verrouillé
        assert client.get("/api/session").json()["next_locked"] is True
        client.post("/api/admin/guided/open-next")
        recv_state(ws, lambda m: "p1" in m["state"]["guided_open"])
        ws.send_json({"type": "advance"})
        m = recv_state(ws, lambda m: m["me"]["phase"] == "p1")
        assert m["me"]["index"] == 1
        # goto vers une phase non ouverte : refusé
        ws.send_json({"type": "goto", "phase": "p3"})
        time.sleep(0.4)
        assert client.get("/api/session").json()["phase"] == "p1"
    assert s.status_code == 200


def test_free_mode_advance_to_end_and_disabled_phase_skipped(admin, client):
    admin.put("/api/admin/phases", json={"order": ["p0", "p1", "p2", "p3", "p4"],
                                          "enabled": {"p1": False, "p4": False}})
    client.post("/api/session")
    vh = cookie_header(client)
    with client.websocket_connect("/api/ws/visitor", headers=vh) as ws:
        recv_state(ws)
        seen = []
        for _ in range(4):
            ws.send_json({"type": "advance"})
            time.sleep(0.25)
            seen.append(client.get("/api/session").json()["phase"])
        assert seen == ["p2", "p3", "end", "end"]


def test_phase_order_and_validation(admin):
    ok = admin.put("/api/admin/phases", json={"order": ["p0", "p3", "p2", "p1", "p4"], "enabled": {"p0": False}})
    assert ok.status_code == 200
    st = admin.get("/api/state").json()
    assert [p["id"] for p in st["phases"]] == ["p0", "p3", "p2", "p1", "p4"]
    assert st["phases"][0]["enabled"] is True  # l'accueil ne peut pas être désactivé
    assert admin.put("/api/admin/phases", json={"order": ["p1", "p0", "p2", "p3", "p4"], "enabled": {}}).status_code == 422
    assert admin.put("/api/admin/phases", json={"order": ["p0", "p1"], "enabled": {}}).status_code == 422


def test_phase_params_validated(admin):
    assert admin.put("/api/admin/phases/p1/params", json={"values": {"target_years": 25}}).status_code == 200
    assert admin.get("/api/state").json()["phases"][1]["params"]["target_years"] == 25
    assert admin.put("/api/admin/phases/p1/params", json={"values": {"target_years": -4}}).status_code == 422
    assert admin.put("/api/admin/phases/p1/params", json={"values": {"target_years": "x"}}).status_code == 422
    assert admin.put("/api/admin/phases/zz/params", json={"values": {}}).status_code == 422


def test_state_persists_across_hub_restart(admin):
    from app.hub import Hub, set_hub

    admin.put("/api/admin/progression", json={"mode": "guided"})
    admin.put("/api/admin/phases/p1/params", json={"values": {"target_years": 42}})
    h = Hub()
    set_hub(h)
    assert h.state.mode == "guided" and h.state.params["p1"]["target_years"] == 42


def test_moderation_and_recent_feed(admin, client):
    pseudo = client.post("/api/session").json()["pseudo"]
    vid = next(v["id"] for v in admin.get("/api/admin/visitors").json())
    time.sleep(0.3)
    assert pseudo in [r["pseudo"] for r in admin.get("/api/state").json()["recent"]]
    admin.post(f"/api/admin/visitors/{vid}/hide", json={"hidden": True})
    assert pseudo not in [r["pseudo"] for r in admin.get("/api/state").json()["recent"]]
    admin.post(f"/api/admin/visitors/{vid}/rename", json={"pseudo": "Gentil Pseudo"})
    assert admin.get("/api/session").json()["pseudo"] == "Gentil Pseudo"
    assert admin.post("/api/admin/visitors/nope/hide", json={"hidden": True}).status_code == 404


def test_screen_settings_and_attract(admin):
    body = {"mode": "attract", "phase_id": "p2", "rotation_s": 10, "attract_after_s": 30,
            "show_wifi_qr": False, "qr_use_host": True}
    assert admin.put("/api/admin/screen", json=body).status_code == 200
    st = admin.get("/api/state").json()
    assert st["attract"] is True and st["screen"]["phase_id"] == "p2"
    assert st["qr"]["url"].startswith("http://parcours.cyber") and st["qr"]["wifi"] is False
    assert admin.put("/api/admin/screen", json={**body, "rotation_s": 1}).status_code == 422
    assert admin.put("/api/admin/screen", json={**body, "phase_id": "zz"}).status_code == 422


def test_qr_endpoints(client, admin):
    assert client.get("/api/qr/url.svg").content.startswith(b"<svg")
    assert client.get("/api/qr/wifi.svg").status_code == 200  # show_wifi_qr par défaut
    admin.put("/api/admin/screen", json={"mode": "auto", "phase_id": "p1", "rotation_s": 20,
                                         "attract_after_s": 90, "show_wifi_qr": False, "qr_use_host": False})
    assert admin.get("/api/qr/wifi.svg").status_code == 200  # admin : toujours
    admin.post("/api/admin/logout")
    assert admin.get("/api/qr/wifi.svg").status_code == 403  # public : refusé


def test_content_override_and_validation(admin):
    vals = admin.get("/api/admin/meta").json()["content_values"]
    assert vals["school_name"] == "Coda" and vals["next_workshop"] == "Atelier suivant"
    assert len(vals["formations"]) == 2
    vals["next_workshop"] = "Atelier Robotique"
    vals["color_brand"] = "#ff0000"
    assert admin.put("/api/admin/content", json={"values": vals}).status_code == 200
    b = admin.get("/api/state").json()["branding"]
    assert b["next_workshop"] == "Atelier Robotique" and b["color_brand"] == "#ff0000"
    vals["color_brand"] = "javascript:alert(1)"
    assert admin.put("/api/admin/content", json={"values": vals}).status_code == 422


def test_logo_upload_and_rejects(admin):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
    assert admin.post("/api/admin/logo", content=svg, headers={"content-type": "image/svg+xml"}).status_code == 200
    assert admin.get("/api/state").json()["branding"]["logo_url"].startswith("/api/logo")
    r = admin.get("/api/logo")
    assert r.content == svg and "sandbox" in r.headers["content-security-policy"]
    assert admin.post("/api/admin/logo", content=b"<svg><script>1</script></svg>",
                      headers={"content-type": "image/svg+xml"}).status_code == 422
    assert admin.post("/api/admin/logo", content=b"x", headers={"content-type": "text/html"}).status_code == 422
    admin.delete("/api/admin/logo")
    assert admin.get("/api/state").json()["branding"]["logo_url"] == "/brand/coda-logo.svg"


def test_demo_bots_appear_and_vanish(admin):
    admin.post("/api/admin/demo", json={"enabled": True, "count": 8})
    for _ in range(40):
        c = admin.get("/api/state").json()["counts"]
        if c["day_total"] >= 8:
            break
        time.sleep(0.3)
    assert c["day_total"] == 8 and c["connected"] == 8
    assert any(v["bot"] for v in admin.get("/api/admin/visitors").json())
    admin.post("/api/admin/demo", json={"enabled": False, "count": 8})
    for _ in range(20):
        if admin.get("/api/state").json()["counts"]["day_total"] == 0:
            break
        time.sleep(0.3)
    assert admin.get("/api/state").json()["counts"]["day_total"] == 0


def test_reset_day_and_csv_is_anonymous(admin, client):
    pseudo = client.post("/api/session").json()["pseudo"]
    csv_text = admin.get("/api/admin/export.csv").text
    assert pseudo not in csv_text and csv_text.splitlines()[0].startswith("arrivee")
    assert len(csv_text.splitlines()) == 2
    assert admin.post("/api/admin/reset", json={"confirm": "non"}).status_code == 422
    assert admin.post("/api/admin/reset", json={"confirm": "RESET"}).status_code == 200
    assert admin.get("/api/state").json()["counts"]["day_total"] == 0
    assert admin.get("/api/session").status_code == 401  # l'ancien cookie ne vaut plus rien


def test_screen_ws_is_public_and_gets_state(client):
    with client.websocket_connect("/api/ws/screen") as ws:
        m = ws.receive_json()
        assert m["type"] == "state" and "me" not in m
        # l'écran ne reçoit jamais de liste de visiteurs
        assert "visitors" not in m and "list" not in m


def test_visitor_ws_malformed_messages_ignored(client):
    client.post("/api/session")
    with client.websocket_connect("/api/ws/visitor", headers=cookie_header(client)) as ws:
        recv_state(ws)
        ws.send_text("pas du json")
        ws.send_json({"type": "hack"})
        ws.send_text("x" * 5000)
        ws.send_json({"type": "hb"})
        assert client.get("/api/session").status_code == 200


def test_visitor_can_go_back_but_not_skip_forward(admin, client):
    client.post("/api/session")
    with client.websocket_connect("/api/ws/visitor", headers=cookie_header(client)) as ws:
        recv_state(ws)
        ws.send_json({"type": "goto", "phase": "p3"})  # saut en avant : refusé
        time.sleep(0.3)
        assert client.get("/api/session").json()["phase"] == "p0"
        for _ in range(2):
            ws.send_json({"type": "advance"})
            time.sleep(0.2)
        me = client.get("/api/session").json()
        assert me["phase"] == "p2" and me["prev"] == "p1"
        ws.send_json({"type": "goto", "phase": "p0"})  # recommencer
        time.sleep(0.3)
        me = client.get("/api/session").json()
        assert me["phase"] == "p0" and me["prev"] is None


def test_admin_moves_visitors_anywhere(admin, client):
    client.post("/api/session")
    vid = admin.get("/api/admin/visitors").json()[0]["id"]
    assert admin.post(f"/api/admin/visitors/{vid}/phase", json={"phase": "end"}).status_code == 200
    assert client.get("/api/session").json()["phase"] == "end"
    assert client.get("/api/session").json()["prev"] == "p4"
    assert admin.post(f"/api/admin/visitors/{vid}/phase", json={"phase": "p2"}).status_code == 200
    assert client.get("/api/session").json()["phase"] == "p2"
    assert admin.post(f"/api/admin/visitors/{vid}/phase", json={"phase": "zz"}).status_code == 404
    assert admin.post("/api/admin/visitors/nope/phase", json={"phase": "p1"}).status_code == 404
    assert admin.post("/api/admin/visitors/phase-all", json={"phase": "p0"}).json()["count"] == 1
    assert client.get("/api/session").json()["phase"] == "p0"
    assert admin.post("/api/admin/visitors/phase-all", json={"phase": "zz"}).status_code == 422


def test_move_survives_restart(admin, client):
    from app.hub import Hub, set_hub

    client.post("/api/session")
    vid = admin.get("/api/admin/visitors").json()[0]["id"]
    admin.post(f"/api/admin/visitors/{vid}/phase", json={"phase": "p3"})
    h = Hub()
    set_hub(h)
    assert h.vis[vid]["phase"] == "p3"


def test_public_content_has_texts_and_glossary(client):
    c = client.get("/api/content").json()
    assert c["texts"]["p0.cta"] == "C'est parti !"
    assert set(c["texts"]["p0.intro"]) == {"curious", "expert"}
    assert c["glossary"]["dns"]["label"] == "DNS"
    assert client.get("/api/state").json()["content_v"] == c["v"]


def test_every_glossary_marker_in_texts_exists(client):
    import re

    c = client.get("/api/content").json()
    for k, v in c["texts"].items():
        for txt in (v.values() if isinstance(v, dict) else [v]):
            for term in re.findall(r"\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]", txt):
                assert term in c["glossary"], f"{k} cite le terme inconnu {term}"


def test_text_override_reset_and_validation(admin, client):
    v0 = client.get("/api/content").json()["v"]
    assert admin.put("/api/admin/texts/p0.cta", json={"value": "Allons-y !"}).status_code == 200
    c = client.get("/api/content").json()
    assert c["texts"]["p0.cta"] == "Allons-y !" and c["v"] > v0
    rows = {r["key"]: r for r in admin.get("/api/admin/texts").json()["texts"]}
    assert rows["p0.cta"]["overridden"] and rows["p0.cta"]["default"] == "C'est parti !"
    # texte à deux variantes : les deux sont obligatoires
    assert admin.put("/api/admin/texts/p0.title", json={"value": {"curious": "a"}}).status_code == 422
    assert admin.put("/api/admin/texts/p0.title", json={"value": "seul"}).status_code == 422
    assert admin.put("/api/admin/texts/p0.title", json={"value": {"curious": "Salut", "expert": "Salut pro"}}).status_code == 200
    assert admin.put("/api/admin/texts/inconnu", json={"value": "x"}).status_code == 422
    assert admin.put("/api/admin/texts/p0.cta", json={"value": ""}).status_code == 422
    admin.delete("/api/admin/texts/p0.cta")
    assert client.get("/api/content").json()["texts"]["p0.cta"] == "C'est parti !"


def test_glossary_edit_and_custom_term(admin, client):
    assert admin.put("/api/admin/glossary/dns", json={"value": {"label": "DNS", "simple": "Annuaire.", "expert": ""}}).status_code == 200
    assert client.get("/api/content").json()["glossary"]["dns"]["simple"] == "Annuaire."
    assert admin.put("/api/admin/glossary/nouveau-mot", json={"value": {"label": "Nouveau", "simple": "Un mot"}}).status_code == 200
    assert "nouveau-mot" in client.get("/api/content").json()["glossary"]
    assert admin.put("/api/admin/glossary/Mauvais Id!", json={"value": {"label": "x", "simple": "y"}}).status_code == 422
    admin.delete("/api/admin/glossary/nouveau-mot")
    admin.delete("/api/admin/glossary/dns")
    g = client.get("/api/content").json()["glossary"]
    assert "nouveau-mot" not in g and g["dns"]["simple"].startswith("L'annuaire")


def test_content_editing_requires_admin(client):
    assert client.put("/api/admin/texts/p0.cta", json={"value": "x"}).status_code == 401
    assert client.get("/api/admin/texts").status_code == 401


def test_opt_in_counted_and_stored(client):
    client.post("/api/session")
    assert client.put("/api/session/consent", json={"consent": True}).json()["consent"] is True
    import time as t
    t.sleep(0.2)
    assert client.get("/api/state").json()["counts"]["opt_in"] == 1
    assert client.put("/api/session/consent", json={"consent": False}).json()["consent"] is False
