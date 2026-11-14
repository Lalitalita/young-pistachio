"""Supervision de la « salle de contrôle » : sondes réelles sur les services de démo et le Raspberry Pi.

Pi : vrai ping (ICMP) si le binaire est disponible, sinon repli TCP (une machine qui répond
« connexion refusée » est bien vivante ; seul un silence ou « hôte injoignable » signifie
qu'elle est coupée).
"""
import asyncio
import errno
import re
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from collections import deque
from concurrent.futures import ThreadPoolExecutor

from .config import settings

SERVICES = [
    {"id": "demo-web", "label": "Site web", "icon": "🌐", "kind": "container"},
    {"id": "demo-api", "label": "API", "icon": "⚙️", "kind": "container"},
    {"id": "demo-db", "label": "Base de données", "icon": "🗄️", "kind": "container"},
    {"id": "dns", "label": "DNS (Pi-hole)", "icon": "🔎", "kind": "service"},
    {"id": "pi", "label": "Serveur physique (Raspberry Pi)", "icon": "🖥️", "kind": "physical"},
]
PI_PORTS = (22, 80, 443, 53, 8080)
PI_DOWN_AFTER = 2  # échecs consécutifs avant de déclarer le Pi coupé (évite le clignotement)


def _tcp(host: str, port: int, timeout: float = 1.2) -> tuple[str, float | None]:
    """('up'|'refused'|'down', ms)."""
    t0 = time.perf_counter()
    try:
        socket.create_connection((host, port), timeout=timeout).close()
        return "up", (time.perf_counter() - t0) * 1000
    except ConnectionRefusedError:
        return "refused", (time.perf_counter() - t0) * 1000
    except OSError as e:
        if e.errno in (errno.EHOSTUNREACH, errno.ENETUNREACH, errno.ETIMEDOUT) or isinstance(e, socket.timeout):
            return "down", None
        return "down", None


def _http(url: str, timeout: float = 1.8) -> tuple[int | None, float | None]:
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, (time.perf_counter() - t0) * 1000
    except urllib.error.HTTPError as e:
        return e.code, (time.perf_counter() - t0) * 1000
    except Exception:
        return None, None


def probe_container(sid: str) -> tuple[str, float | None]:
    if sid == "demo-web":
        code, ms = _http("http://demo-web/health")
    elif sid == "demo-api":
        code, ms = _http("http://demo-api:8080/health")
        if code == 503:
            return "degraded", ms  # l'API répond mais sa base est tombée
    else:  # demo-db
        st, ms = _tcp("demo-db", 5432)
        return ("up" if st == "up" else "down"), ms
    return ("up" if code == 200 else "down"), ms


def probe_dns() -> tuple[str, float | None]:
    st, ms = _tcp("pihole", 53)
    return ("up" if st == "up" else "down"), ms


def _icmp(ip: str) -> tuple[bool | None, float | None]:
    """True/False si le ping a pu être fait, None si indisponible (binaire absent / non autorisé)."""
    exe = shutil.which("ping")
    if not exe:
        return None, None
    try:
        r = subprocess.run([exe, "-c", "1", "-W", "1", ip], capture_output=True, text=True, timeout=3)
    except Exception:
        return None, None
    if r.returncode == 0:
        m = re.search(r"time[=<]([\d.]+)", r.stdout)
        return True, float(m.group(1)) if m else None
    return (False, None) if r.returncode == 1 else (None, None)


def probe_pi(ip: str) -> tuple[bool, float | None]:
    alive, ms = _icmp(ip)
    if alive is not None:
        return alive, ms
    with ThreadPoolExecutor(len(PI_PORTS)) as ex:
        results = list(ex.map(lambda p: _tcp(ip, p, 0.8), PI_PORTS))
    for st, ms in results:
        if st in ("up", "refused"):
            return True, ms
    return False, None


class Monitor:
    def __init__(self) -> None:
        self.status: dict[str, dict] = {s["id"]: {"status": "unknown", "ms": None} for s in SERVICES}
        self.events: deque = deque(maxlen=8)
        self.pi_fail = 0
        self.pi_changed_at: float | None = None
        self.forced_down: set[str] = set()  # panne simulée (boss sans chaos-agent)
        self._pool = ThreadPoolExecutor(8)

    def note(self, text: str, level: str) -> None:
        self.events.appendleft({"t": time.time(), "text": text, "level": level})

    def set_status(self, sid: str, status: str, ms: float | None) -> None:
        if sid in self.forced_down:
            status, ms = "down", None
        old = self.status[sid]["status"]
        self.status[sid] = {"status": status, "ms": None if ms is None else round(ms)}
        if old == status or old == "unknown":
            return
        label = next(s["label"] for s in SERVICES if s["id"] == sid)
        if sid == "pi":
            self.pi_changed_at = time.time()
            self.note(("🔌 Le serveur physique ne répond plus : câble débranché ?" if status == "down"
                       else "✅ Le serveur physique est de retour"), "bad" if status == "down" else "ok")
        elif status == "down":
            self.note(f"🔴 {label} est tombé", "bad")
        elif status == "degraded":
            self.note(f"🟠 {label} est dégradé", "warn")
        elif status == "up":
            self.note(f"🟢 {label} est de retour", "ok")

    async def refresh(self) -> None:
        loop = asyncio.get_running_loop()
        jobs = {s["id"]: loop.run_in_executor(self._pool, probe_container, s["id"])
                for s in SERVICES if s["kind"] == "container"}
        jobs["dns"] = loop.run_in_executor(self._pool, probe_dns)
        pi_job = loop.run_in_executor(self._pool, probe_pi, settings.pi_ip) if settings.pi_ip else None
        for sid, job in jobs.items():
            st, ms = await job
            self.set_status(sid, st, ms)
        if pi_job:
            alive, ms = await pi_job
            self.pi_fail = 0 if alive else self.pi_fail + 1
            if alive:
                self.set_status("pi", "up", ms)
            elif self.pi_fail >= PI_DOWN_AFTER:
                self.set_status("pi", "down", None)

    def public(self) -> dict:
        out = []
        for s in SERVICES:
            st = self.status[s["id"]]
            if s["id"] == "pi" and not settings.pi_ip:
                st = {"status": "unknown", "ms": None}
            out.append({**s, **st})
        return {"services": out, "events": list(self.events), "pi_changed_at": self.pi_changed_at,
                "pi_configured": bool(settings.pi_ip)}
