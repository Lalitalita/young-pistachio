"""Tests du chaos-agent : `cd chaos-agent && python -m pytest -q`."""
import json
import threading
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

import pytest

import agent as A


class FakeDocker:
    def __init__(self):
        self.running = {c: True for c in A.ALLOWLIST.values()}
        self.calls = []

    def is_running(self, c):
        return self.running[c]

    def stop(self, c):
        self.calls.append(("stop", c))
        self.running[c] = False

    def start(self, c):
        self.calls.append(("start", c))
        self.running[c] = True


class Clock:
    t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture
def setup():
    clock, docker = Clock(), FakeDocker()
    ag = A.Agent(docker, "secret-token", clock)
    return ag, docker, clock


def test_allowlist_and_actions(setup):
    ag, docker, _ = setup
    assert ag.act("pihole", "stop")[0] == 403
    assert ag.act("app", "stop")[0] == 403
    assert ag.act("../../etc", "stop")[0] == 403
    assert ag.act("demo-web", "kill")[0] == 400
    assert ag.act("demo-web", "restart")[0] == 400
    assert docker.calls == []
    assert ag.act("demo-web", "stop") == (200, {"ok": True, "service": "demo-web", "action": "stop"})
    assert docker.calls == [("stop", "cp-demo-web")]


def test_token_check(setup):
    ag, *_ = setup
    assert ag.authorized("Bearer secret-token")
    assert not ag.authorized("Bearer nope")
    assert not ag.authorized("secret-token")
    assert not ag.authorized(None)
    assert not A.Agent(FakeDocker(), "", Clock()).authorized("Bearer ")


def test_service_cooldown_and_rate_limit(setup):
    ag, _, clock = setup
    assert ag.act("demo-web", "stop")[0] == 200
    assert ag.act("demo-web", "start")[0] == 429  # trop vite
    clock.t += A.SERVICE_COOLDOWN_S + 0.1
    assert ag.act("demo-web", "start")[0] == 200
    codes = []
    for i in range(A.RATE_PER_MIN + 5):
        clock.t += A.SERVICE_COOLDOWN_S + 0.1
        codes.append(ag.act("demo-api", "stop")[0])
    assert 429 in codes


def test_watchdog_restarts_after_max_down(setup):
    ag, docker, clock = setup
    ag.act("demo-db", "stop")
    assert not docker.running["cp-demo-db"]
    clock.t += A.MAX_DOWN_S - 1
    assert ag.watchdog_once() == []
    clock.t += 2
    assert ag.watchdog_once() == ["demo-db"]
    assert docker.running["cp-demo-db"]


def test_status(setup):
    ag, docker, _ = setup
    ag.act("demo-api", "stop")
    assert ag.status() == {"demo-web": "running", "demo-api": "stopped", "demo-db": "running"}


def test_http_end_to_end(setup):
    ag, docker, _ = setup
    srv = ThreadingHTTPServer(("127.0.0.1", 0), A.make_handler(ag))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    port = srv.server_address[1]

    def req(method, path, body=None, token="secret-token"):
        c = HTTPConnection("127.0.0.1", port, timeout=5)
        h = {"Authorization": f"Bearer {token}"} if token else {}
        c.request(method, path, json.dumps(body) if body is not None else None, h)
        r = c.getresponse()
        return r.status, r.read()

    try:
        assert req("GET", "/health", token=None)[0] == 200
        assert req("GET", "/status", token=None)[0] == 401
        assert req("POST", "/action", {"service": "demo-web", "action": "stop"}, token="bad")[0] == 401
        assert req("POST", "/action", {"service": "demo-web", "action": "stop"})[0] == 200
        assert req("POST", "/action", {"service": "pihole", "action": "stop"})[0] == 403
        assert req("POST", "/action", {"oops": 1})[0] == 400
        assert req("POST", "/autre", {})[0] == 404
        assert docker.calls == [("stop", "cp-demo-web")]
    finally:
        srv.shutdown()
