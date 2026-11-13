"""Routes publiques : session visiteur, état, QR, logo et WebSockets."""
import asyncio
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response, WebSocket
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field, ValidationError

from . import characters, content, db, phase1, qr
from .config import settings
from .hub import get_hub
from .security import (COOKIE_VISITOR, VISITOR_MAX_AGE, client_ip, is_admin, limiter, make_token,
                       visitor_id)

router = APIRouter(prefix="/api")


def _limit(request: Request | WebSocket, bucket: str, limit: int, window: float = 60) -> None:
    if not limiter.allow(f"{bucket}:{client_ip(request)}", limit, window):
        raise HTTPException(429, "Trop de requêtes, patiente un peu.")


def _current(request: Request) -> str:
    vid = visitor_id(request)
    if not vid or vid not in get_hub().vis or get_hub().vis[vid]["bot"]:
        raise HTTPException(401, "Pas de session")
    return vid


@router.get("/state")
async def state():
    return get_hub().public_state()


@router.get("/content")
async def get_content():
    """Textes (curieux/expert) et glossaire, fusionnés avec les surcharges de l'admin."""
    return {"v": content.version(), "texts": content.get_texts(), "glossary": content.get_glossary()}


@router.post("/session")
async def create_session(request: Request, response: Response):
    """Idempotent : renvoie la session existante (cookie valide) ou en crée une."""
    hub = get_hub()
    vid = visitor_id(request)
    if not (vid and vid in hub.vis and not hub.vis[vid]["bot"]):
        _limit(request, "session", 40)
        vid = hub.create_visitor()["id"]
        response.set_cookie(COOKIE_VISITOR, make_token("visitor", vid), max_age=VISITOR_MAX_AGE,
                            httponly=True, samesite="lax", path="/")  # HTTP simple : pas de Secure
    return hub.me(vid)


@router.get("/session")
async def get_session(request: Request):
    return get_hub().me(_current(request))


@router.post("/session/reroll")
async def reroll(request: Request):
    vid = _current(request)
    _limit(request, "reroll", 20)
    get_hub().reroll(vid)
    return get_hub().me(vid)


class ConsentBody(BaseModel):
    consent: bool


@router.put("/session/consent")
async def consent(body: ConsentBody, request: Request):
    vid = _current(request)
    get_hub().set_consent(vid, body.consent)
    return get_hub().me(vid)


@router.get("/character")
async def character(request: Request):
    vid = _current(request)
    return characters.get_or_create(vid)


class TimesBody(BaseModel):
    # Des temps de cassage énormes sont attendus (mots de passe très solides) : large marge.
    online: float = Field(ge=0, le=1e60)
    offline_fast: float = Field(ge=0, le=1e60)
    gpu_farm: float = Field(ge=0, le=1e60)


class Phase1Submit(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    length: int = Field(ge=0, le=128)
    score: float = Field(ge=0, le=100)
    patterns: list[str] = Field(default_factory=list, max_length=25)
    times: TimesBody


@router.post("/phase1/submit")
async def phase1_submit(body: Phase1Submit, request: Request):
    vid = _current(request)
    _limit(request, "p1submit", 30)
    hub = get_hub()
    res = phase1.save_submission(vid, hub.vis[vid]["pseudo"], {**body.model_dump(), "times": body.times.model_dump()})
    hub.touch()
    hub.request_broadcast(visitors=False)
    return res


@router.get("/qr/{kind}.svg")
async def qr_svg(kind: Literal["url", "wifi"], request: Request):
    hub = get_hub()
    if kind == "url":
        data = qr.urls(hub.state.screen["qr_use_host"])[0]
    else:
        if not settings.wifi_ssid:
            raise HTTPException(404, "WIFI_SSID non configuré dans .env")
        if not (is_admin(request) or hub.state.screen["show_wifi_qr"]):
            raise HTTPException(403, "QR Wi-Fi non public")
        data = qr.wifi_payload(settings.wifi_ssid, settings.wifi_password, settings.wifi_security)
    return Response(qr.svg(data), media_type="image/svg+xml", headers={"Cache-Control": "no-cache"})


@router.get("/logo")
async def logo():
    p = content.logo_path()
    if not p.exists():
        return RedirectResponse("/brand/coda-logo.svg")
    return FileResponse(p, media_type=db.kv_get("logo_type", "image/png"),
                        headers={"Content-Security-Policy": "default-src 'none'; sandbox"})


# ---------------- WebSockets ----------------
class ClientMsg(BaseModel):
    type: Literal["hb", "advance", "goto", "consent"]
    phase: str | None = None
    consent: bool | None = None


async def _pump(ws: WebSocket, on_msg=None) -> None:
    """Boucle de réception : coupe si le client ne donne plus signe de vie (>75 s)."""
    window: list[float] = []
    loop = asyncio.get_running_loop()
    while True:
        raw = await asyncio.wait_for(ws.receive_text(), 75)
        now = loop.time()
        window = [t for t in window if t > now - 5] + [now]
        if len(raw) > 2000 or len(window) > 30:  # message énorme ou rafale : ignoré
            continue
        if on_msg:
            try:
                on_msg(ClientMsg.model_validate_json(raw))
            except ValidationError:
                pass


async def _guard(ws: WebSocket) -> bool:
    if not limiter.allow(f"ws:{client_ip(ws)}", 60, 60):
        await ws.close(4429)
        return False
    return True


@router.websocket("/ws/visitor", name="ws_visitor")
async def ws_visitor(ws: WebSocket):
    hub = get_hub()
    if not await _guard(ws):
        return
    vid = visitor_id(ws)
    await ws.accept()
    if not vid or vid not in hub.vis or hub.vis[vid]["bot"]:
        await ws.send_text('{"type":"no_session"}')
        await ws.close(4401)
        return
    hub.sockets.setdefault(vid, set()).add(ws)
    hub.touch()
    hub.request_broadcast()
    await hub.snapshot(ws, vid)

    def on_msg(m: ClientMsg) -> None:
        if m.type == "advance":
            hub.advance(vid)
        elif m.type == "goto" and m.phase:
            hub.goto(vid, m.phase)
        elif m.type == "consent" and m.consent is not None:
            hub.set_consent(vid, m.consent)

    try:
        await _pump(ws, on_msg)
    except Exception:
        pass
    finally:
        hub.sockets.get(vid, set()).discard(ws)
        hub.request_broadcast()


@router.websocket("/ws/screen", name="ws_screen")
async def ws_screen(ws: WebSocket):
    hub = get_hub()
    if not await _guard(ws):
        return
    await ws.accept()
    hub.screens.add(ws)
    await hub.snapshot(ws)
    try:
        await _pump(ws)
    except Exception:
        pass
    finally:
        hub.screens.discard(ws)


@router.websocket("/ws/admin", name="ws_admin")
async def ws_admin(ws: WebSocket):
    hub = get_hub()
    if not await _guard(ws):
        return
    await ws.accept()
    if not is_admin(ws):
        await ws.send_text('{"type":"unauthorized"}')
        await ws.close(4403)
        return
    hub.admins.add(ws)
    await hub.snapshot(ws)
    try:
        await _pump(ws)
    except Exception:
        pass
    finally:
        hub.admins.discard(ws)
