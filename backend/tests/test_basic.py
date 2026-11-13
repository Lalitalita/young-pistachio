def test_health_and_wal(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["sqlite_journal_mode"] == "wal"


def test_csp_header(client):
    csp = client.get("/api/health").headers["content-security-policy"]
    assert "default-src 'self'" in csp and "unsafe-eval" not in csp


def test_unknown_api_is_404(client):
    assert client.get("/api/nope").status_code == 404
