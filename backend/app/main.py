"""Cyber Parcours : point d'entrée FastAPI (un seul process uvicorn)."""
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import admin, api, bots, db
from .config import DEFAULT_SECRET, settings
from .hub import Hub, get_hub, set_hub
from .security import client_ip, limiter

log = logging.getLogger("cyber")

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "style-src-attr 'unsafe-inline'; "  # styles dynamiques (jauges) via attribut style
    "img-src 'self' data:; "
    "font-src 'self'; "
    "connect-src 'self' ws: wss:; "  # ws: explicite pour les vieux Safari
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.secret_key == DEFAULT_SECRET or settings.admin_password == "change-moi":
        log.warning("⚠️  SECRET_KEY / ADMIN_PASSWORD par défaut : change-les dans .env")
    app.state.journal_mode = db.init_db()
    app.state.started = time.time()
    limiter.reset()
    hub = Hub()
    set_hub(hub)
    tasks = [asyncio.create_task(hub.run()), asyncio.create_task(bots.run(hub))]
    yield
    for t in tasks:
        t.cancel()
    set_hub(None)


app = FastAPI(title="Cyber Parcours", lifespan=lifespan, docs_url=None, redoc_url=None)
app.include_router(api.router)
app.include_router(admin.router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("Content-Security-Policy", CSP)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/api/health")
async def health(request: Request):
    return {"status": "ok", "uptime_s": round(time.time() - request.app.state.started, 1),
            "sqlite_journal_mode": request.app.state.journal_mode,
            "connected": get_hub().public_state()["counts"]["connected"]}


@app.get("/api/whoami")
async def whoami(request: Request):
    """Montre l'IP source vue par l'app (doit être celle du téléphone, pas 172.x)."""
    return {"ip": client_ip(request)}


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def api_not_found(rest: str):
    return JSONResponse({"detail": "not found"}, status_code=404)


# --- Front buildé (monté seulement s'il existe : dev/tests sans build) ---
_static = Path(settings.static_dir)
if (_static / "index.html").exists():
    if (_static / "assets").exists():
        app.mount("/assets", StaticFiles(directory=_static / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        candidate = (_static / path).resolve()
        if path and candidate.is_file() and _static.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_static / "index.html", headers={"Cache-Control": "no-cache"})
