"""Client du chaos-agent (réseau interne uniquement, jeton partagé). Appels bloquants : à lancer en thread."""
import json
import urllib.error
import urllib.request

from .config import settings

SERVICES = ("demo-web", "demo-api", "demo-db")


class ChaosError(Exception):
    pass


def _call(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(settings.chaos_url + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {settings.chaos_token}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read()).get("error", "")
        except Exception:
            msg = ""
        raise ChaosError(f"chaos-agent a refusé ({e.code}) {msg}".strip()) from e
    except (OSError, ValueError) as e:
        raise ChaosError(f"chaos-agent injoignable : {e}") from e


def action(service: str, act: str) -> None:
    if service not in SERVICES or act not in ("stop", "start"):
        raise ChaosError("action non autorisée")
    _call("POST", "/action", {"service": service, "action": act})


def status() -> dict:
    return _call("GET", "/status")
