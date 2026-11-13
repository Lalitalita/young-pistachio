"""Cyber Parcours : point d'entrée FastAPI (un seul process uvicorn)."""
import asyncio
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .config import settings

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

SPA_ROUTES = {"", "screen", "admin"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.journal_mode = db.init_db()
    app.state.started = time.time()
    yield


app = FastAPI(title="Cyber Parcours", lifespan=lifespan, docs_url=None, redoc_url=None)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def client_ip(request: Request) -> str:
    # Pas de --proxy-headers : on veut l'IP source réelle du téléphone.
    return request.client.host if request.client else "?"


@app.get("/api/health")
async def health(request: Request):
    return {
        "status": "ok",
        "uptime_s": round(time.time() - request.app.state.started, 1),
        "sqlite_journal_mode": request.app.state.journal_mode,
    }


@app.get("/api/whoami")
async def whoami(request: Request):
    """Montre l'IP source vue par l'app (doit être celle du téléphone, pas 172.x)."""
    return {"ip": client_ip(request)}


@app.websocket("/ws/{role}")
async def ws_endpoint(ws: WebSocket, role: str):
    if role not in {"visitor", "screen", "admin"}:
        await ws.close(code=4404)
        return
    await ws.accept()
    await ws.send_json({"type": "hello", "role": role, "server_time": time.time()})
    try:
        while True:
            msg = await asyncio.wait_for(ws.receive_text(), timeout=60)
            if msg == "ping":
                await ws.send_json({"type": "pong"})
    except (WebSocketDisconnect, asyncio.TimeoutError, RuntimeError):
        pass


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
