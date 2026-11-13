"""Cookies signés (HMAC) et rate limiting en mémoire."""
import hashlib
import hmac
import time
from collections import defaultdict, deque

from fastapi import Request, WebSocket

from .config import settings

COOKIE_VISITOR = "cp_sid"
COOKIE_ADMIN = "cp_admin"
VISITOR_MAX_AGE = 24 * 3600
ADMIN_MAX_AGE = 12 * 3600


def _sig(kind: str, value: str, ts: int) -> str:
    return hmac.new(settings.secret_key.encode(), f"{kind}|{value}|{ts}".encode(), hashlib.sha256).hexdigest()[:40]


def make_token(kind: str, value: str, now: float | None = None) -> str:
    ts = int(time.time() if now is None else now)
    return f"{value}.{ts}.{_sig(kind, value, ts)}"


def read_token(kind: str, token: str | None, max_age: int, now: float | None = None) -> str | None:
    if not token:
        return None
    try:
        value, ts_s, sig = token.rsplit(".", 2)
        ts = int(ts_s)
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sig(kind, value, ts)):
        return None
    t = time.time() if now is None else now
    if t - ts > max_age or ts > t + 60:
        return None
    return value


def client_ip(conn: Request | WebSocket) -> str:
    # Pas de --proxy-headers : on garde l'IP source réelle du téléphone.
    return conn.client.host if conn.client else "?"


def is_admin(conn: Request | WebSocket) -> bool:
    return read_token("admin", conn.cookies.get(COOKIE_ADMIN), ADMIN_MAX_AGE) == "admin"


def visitor_id(conn: Request | WebSocket) -> str | None:
    return read_token("visitor", conn.cookies.get(COOKIE_VISITOR), VISITOR_MAX_AGE)


class RateLimiter:
    """Fenêtre glissante par clé."""

    def __init__(self) -> None:
        self.hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str, limit: int, window: float, now: float | None = None) -> bool:
        t = time.monotonic() if now is None else now
        q = self.hits[key]
        while q and q[0] <= t - window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(t)
        if len(self.hits) > 20000:  # purge grossière
            for k in [k for k, v in self.hits.items() if not v or v[-1] <= t - window]:
                del self.hits[k]
        return True

    def reset(self) -> None:
        self.hits.clear()


limiter = RateLimiter()
