import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ["STATIC_DIR"] = tempfile.mkdtemp()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_health_and_wal():
    with TestClient(app) as c:
        r = c.get("/api/health")
        assert r.status_code == 200
        assert r.json()["sqlite_journal_mode"] == "wal"


def test_csp_header():
    with TestClient(app) as c:
        csp = c.get("/api/health").headers["content-security-policy"]
        assert "default-src 'self'" in csp
        assert "unsafe-eval" not in csp


def test_unknown_api_is_404():
    with TestClient(app) as c:
        assert c.get("/api/nope").status_code == 404


def test_websocket_hello():
    with TestClient(app) as c, c.websocket_connect("/ws/screen") as ws:
        assert ws.receive_json()["type"] == "hello"
        ws.send_text("ping")
        assert ws.receive_json()["type"] == "pong"


def test_websocket_bad_role():
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with TestClient(app) as c:
        with pytest.raises(WebSocketDisconnect):
            with c.websocket_connect("/ws/hacker"):
                pass
