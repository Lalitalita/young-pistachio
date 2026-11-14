"""chaos-agent : coupe / relance UNIQUEMENT les conteneurs de démo, sur demande de l'app.

Garde-fous (défense en profondeur) :
- réseau interne uniquement, aucun port publié ;
- jeton partagé (Authorization: Bearer ...), comparé en temps constant ;
- allowlist stricte de noms logiques -> conteneurs ; rien d'autre n'est joignable ;
- actions stop / start uniquement ;
- rate limiting global + délai minimum entre deux actions sur un même service ;
- chien de garde : tout service arrêté est relancé automatiquement après MAX_DOWN_S ;
- parle à Docker via un docker-socket-proxy restreint (jamais le socket complet).
"""
import hmac
import http.client
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# nom logique (utilisé par l'app) -> nom du conteneur Docker (fixé dans docker-compose.yml)
ALLOWLIST = {
    "demo-web": "cp-demo-web",
    "demo-api": "cp-demo-api",
    "demo-db": "cp-demo-db",
}
ACTIONS = ("stop", "start")
MAX_DOWN_S = int(os.environ.get("CHAOS_MAX_DOWN_S", "180"))
SERVICE_COOLDOWN_S = float(os.environ.get("CHAOS_SERVICE_COOLDOWN_S", "3"))
RATE_PER_MIN = int(os.environ.get("CHAOS_RATE_PER_MIN", "20"))


class DockerError(Exception):
    pass


class DockerClient:
    """Client minimal de l'API Docker (via docker-socket-proxy en TCP interne)."""

    def __init__(self, host: str, port: int) -> None:
        self.host, self.port = host, port

    def _call(self, method: str, path: str) -> tuple[int, bytes]:
        conn = http.client.HTTPConnection(self.host, self.port, timeout=15)
        try:
            conn.request(method, path)
            r = conn.getresponse()
            return r.status, r.read()
        except OSError as e:
            raise DockerError(f"Docker injoignable : {e}") from e
        finally:
            conn.close()

    def is_running(self, container: str) -> bool:
        status, body = self._call("GET", f"/containers/{container}/json")
        if status == 404:
            raise DockerError("conteneur introuvable")
        if status != 200:
            raise DockerError(f"état illisible ({status})")
        return bool(json.loads(body).get("State", {}).get("Running"))

    def stop(self, container: str) -> None:
        status, _ = self._call("POST", f"/containers/{container}/stop?t=2")
        if status not in (204, 304):
            raise DockerError(f"stop refusé ({status})")

    def start(self, container: str) -> None:
        status, _ = self._call("POST", f"/containers/{container}/start")
        if status not in (204, 304):
            raise DockerError(f"start refusé ({status})")


class Agent:
    def __init__(self, docker, token: str, clock=time.monotonic) -> None:
        self.docker, self.token, self.clock = docker, token, clock
        self.lock = threading.Lock()
        self.calls: list[float] = []
        self.last_action: dict[str, float] = {}
        self.stopped_at: dict[str, float] = {}

    # ----- sécurité -----
    def authorized(self, header: str | None) -> bool:
        if not self.token or not header or not header.startswith("Bearer "):
            return False
        return hmac.compare_digest(header[7:].encode(), self.token.encode())

    def _rate_ok(self) -> bool:
        now = self.clock()
        self.calls = [t for t in self.calls if t > now - 60]
        if len(self.calls) >= RATE_PER_MIN:
            return False
        self.calls.append(now)
        return True

    # ----- actions -----
    def act(self, service: str, action: str) -> tuple[int, dict]:
        if service not in ALLOWLIST:
            return 403, {"error": "service non autorisé"}
        if action not in ACTIONS:
            return 400, {"error": "action non autorisée"}
        with self.lock:
            if not self._rate_ok():
                return 429, {"error": "trop d'actions, patiente"}
            now = self.clock()
            if now - self.last_action.get(service, -1e9) < SERVICE_COOLDOWN_S:
                return 429, {"error": "service sollicité trop vite"}
            self.last_action[service] = now
            container = ALLOWLIST[service]
            try:
                (self.docker.stop if action == "stop" else self.docker.start)(container)
            except DockerError as e:
                return 502, {"error": str(e)}
            if action == "stop":
                self.stopped_at[service] = now
            else:
                self.stopped_at.pop(service, None)
            return 200, {"ok": True, "service": service, "action": action}

    def status(self) -> dict:
        out = {}
        for name, container in ALLOWLIST.items():
            try:
                out[name] = "running" if self.docker.is_running(container) else "stopped"
            except DockerError:
                out[name] = "unknown"
        return out

    def watchdog_once(self) -> list[str]:
        """Relance les services arrêtés depuis plus de MAX_DOWN_S (filet de sécurité)."""
        revived = []
        with self.lock:
            now = self.clock()
            for service, t in list(self.stopped_at.items()):
                if now - t >= MAX_DOWN_S:
                    try:
                        self.docker.start(ALLOWLIST[service])
                        del self.stopped_at[service]
                        revived.append(service)
                    except DockerError:
                        pass  # on réessaiera au prochain tour
        return revived


def make_handler(agent: Agent):
    class H(BaseHTTPRequestHandler):
        def _send(self, code: int, body: dict | None = None) -> None:
            data = json.dumps(body if body is not None else {}).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *a) -> None:  # silence : pas de bruit dans les logs
            pass

        def do_GET(self) -> None:
            if self.path == "/health":
                return self._send(200, {"ok": True})
            if not agent.authorized(self.headers.get("Authorization")):
                return self._send(401, {"error": "jeton invalide"})
            if self.path == "/status":
                return self._send(200, agent.status())
            self._send(404)

        def do_POST(self) -> None:
            if not agent.authorized(self.headers.get("Authorization")):
                return self._send(401, {"error": "jeton invalide"})
            if self.path != "/action":
                return self._send(404)
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if not 0 < n <= 500:
                    return self._send(400, {"error": "corps invalide"})
                body = json.loads(self.rfile.read(n))
                service, action = str(body["service"]), str(body["action"])
            except (ValueError, KeyError, TypeError):
                return self._send(400, {"error": "corps invalide"})
            self._send(*agent.act(service, action))

    return H


def main() -> None:
    token = os.environ.get("CHAOS_TOKEN", "")
    if not token or token.startswith("change-moi"):
        print("⚠️  CHAOS_TOKEN par défaut ou vide : change-le dans .env", flush=True)
    docker = DockerClient(os.environ.get("DOCKER_HOST_NAME", "docker-proxy"),
                          int(os.environ.get("DOCKER_HOST_PORT", "2375")))
    agent = Agent(docker, token)

    def loop() -> None:
        while True:
            time.sleep(5)
            agent.watchdog_once()

    threading.Thread(target=loop, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", 9000), make_handler(agent)).serve_forever()


if __name__ == "__main__":
    main()
