import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["ADMIN_PASSWORD"] = "test-admin"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["CONTENT_DIR"] = str(ROOT.parent / "content")
os.environ["STATIC_DIR"] = tempfile.mkdtemp()
os.environ["WIFI_SSID"] = "MonWifi"
os.environ["WIFI_PASSWORD"] = "p;ss:word"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin(client):
    assert client.post("/api/admin/login", json={"password": "test-admin"}).status_code == 200
    return client


def cookie_header(c):
    return {"cookie": "; ".join(f"{k}={v}" for k, v in c.cookies.items())}
