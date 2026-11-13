"""API d'administration (cookie de session signé, rate limiting, validation Pydantic)."""
import csv
import hmac
import io
import time
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from . import content, db, phase1, schema
from .config import settings
from .hub import get_hub
from .phases import BY_ID, IDS, PHASES
from .security import ADMIN_MAX_AGE, COOKIE_ADMIN, client_ip, is_admin, limiter, make_token


def require_admin(request: Request) -> None:
    if not is_admin(request):
        raise HTTPException(401, "Connexion admin requise")
    if not limiter.allow(f"admin:{client_ip(request)}", 240, 60):
        raise HTTPException(429, "Trop de requêtes")


router = APIRouter(prefix="/api/admin")
secured = APIRouter(dependencies=[Depends(require_admin)])


def _ok(fn, *a):
    try:
        return fn(*a)
    except schema.SchemaError as e:
        raise HTTPException(422, str(e)) from e


def _commit(hub) -> dict:
    hub.state.save()
    hub.request_broadcast()
    return {"ok": True}


class LoginBody(BaseModel):
    password: str = Field(max_length=200)


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    if not limiter.allow(f"login:{client_ip(request)}", 6, 60):
        raise HTTPException(429, "Trop d'essais, attends une minute.")
    if not hmac.compare_digest(body.password.encode(), settings.admin_password.encode()):
        raise HTTPException(401, "Mot de passe incorrect")
    response.set_cookie(COOKIE_ADMIN, make_token("admin", "admin"), max_age=ADMIN_MAX_AGE,
                        httponly=True, samesite="strict", path="/")
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_ADMIN, path="/")
    return {"ok": True}


@secured.get("/me")
async def me():
    return {"ok": True}


@secured.get("/meta")
async def meta():
    return {
        "phase_schemas": {p["id"]: p["schema"] for p in PHASES},
        "content_schema": content.BRANDING_SCHEMA,
        "content_values": content.get_branding(),
        "wifi": {"ssid": settings.wifi_ssid, "security": settings.wifi_security,
                 "has_password": bool(settings.wifi_password)},
        "custom_logo": content.logo_path().exists(),
    }


class ProgressionBody(BaseModel):
    mode: Literal["free", "guided"]


@secured.put("/progression")
async def progression(body: ProgressionBody):
    hub = get_hub()
    hub.state.mode = body.mode
    return _commit(hub)


@secured.post("/guided/open-next")
async def open_next():
    hub = get_hub()
    hub.state.open_next()
    return _commit(hub)


@secured.post("/guided/close-last")
async def close_last():
    hub = get_hub()
    hub.state.close_last()
    return _commit(hub)


class PhasesBody(BaseModel):
    order: list[str]
    enabled: dict[str, bool]


@secured.put("/phases")
async def phases(body: PhasesBody):
    hub = get_hub()
    _ok(hub.state.set_phases, body.order, body.enabled)
    return _commit(hub)


class ParamsBody(BaseModel):
    values: dict


@secured.put("/phases/{pid}/params")
async def phase_params(pid: str, body: ParamsBody):
    hub = get_hub()
    _ok(hub.state.set_params, pid, body.values)
    return _commit(hub)


class ScreenBody(BaseModel):
    mode: Literal["auto", "phase", "attract"]
    phase_id: str
    rotation_s: int = Field(ge=5, le=120)
    attract_after_s: int = Field(ge=0, le=3600)
    show_wifi_qr: bool
    qr_use_host: bool


@secured.put("/screen")
async def screen(body: ScreenBody):
    if body.phase_id not in IDS:
        raise HTTPException(422, "Phase inconnue")
    hub = get_hub()
    hub.state.screen.update(body.model_dump())
    return _commit(hub)


class ContentBody(BaseModel):
    values: dict


@secured.put("/content")
async def put_content(body: ContentBody):
    _ok(content.set_branding, body.values)
    get_hub().request_broadcast(visitors=False)
    return {"ok": True}


@secured.post("/logo")
async def upload_logo(request: Request):
    ct = (request.headers.get("content-type") or "").split(";")[0].strip()
    data = await request.body()
    _ok(content.save_logo, data, ct)
    get_hub().request_broadcast(visitors=False)
    return {"ok": True}


@secured.delete("/logo")
async def reset_logo():
    content.delete_logo()
    get_hub().request_broadcast(visitors=False)
    return {"ok": True}


@secured.get("/texts")
async def texts():
    return {"texts": content.text_rows(), "glossary": content.glossary_rows()}


class ValueBody(BaseModel):
    value: dict | str


def _changed():
    get_hub().request_broadcast(visitors=False)
    return {"ok": True}


@secured.put("/texts/{key}")
async def put_text(key: str, body: ValueBody):
    _ok(content.set_text, key, body.value)
    return _changed()


@secured.delete("/texts/{key}")
async def del_text(key: str):
    content.reset_text(key)
    return _changed()


@secured.put("/glossary/{key}")
async def put_term(key: str, body: ValueBody):
    _ok(content.set_glossary, key, body.value)
    return _changed()


@secured.delete("/glossary/{key}")
async def del_term(key: str):
    content.reset_glossary(key)
    return _changed()


@secured.get("/phase1/lookup")
async def phase1_lookup(q: str = ""):
    if len(q.strip()) < 2:
        raise HTTPException(422, "Au moins 2 caractères")
    return phase1.lookup(q.strip())


@secured.get("/visitors")
async def visitors():
    return get_hub().visitor_list()


class HideBody(BaseModel):
    hidden: bool


class RenameBody(BaseModel):
    pseudo: str = Field(min_length=1, max_length=30)


@secured.post("/visitors/{vid}/hide")
async def hide(vid: str, body: HideBody):
    if not get_hub().moderate(vid, hidden=body.hidden):
        raise HTTPException(404, "Visiteur inconnu")
    return {"ok": True}


@secured.post("/visitors/{vid}/rename")
async def rename(vid: str, body: RenameBody):
    if not get_hub().moderate(vid, pseudo=body.pseudo.strip()):
        raise HTTPException(404, "Visiteur inconnu")
    return {"ok": True}


class PhaseBody(BaseModel):
    phase: str


@secured.post("/visitors/phase-all")
async def phase_all(body: PhaseBody):
    n = get_hub().set_phase_all(body.phase)
    if n < 0:
        raise HTTPException(422, "Étape inconnue")
    return {"ok": True, "count": n}


@secured.post("/visitors/{vid}/phase")
async def visitor_phase(vid: str, body: PhaseBody):
    if not get_hub().set_phase(vid, body.phase):
        raise HTTPException(404, "Visiteur ou étape inconnu")
    return {"ok": True}


@secured.delete("/leaderboard/{phase}")
async def clear_leaderboard(phase: str):
    if phase not in BY_ID:
        raise HTTPException(404, "Phase inconnue")
    db.run("DELETE FROM scores WHERE phase=?", (phase,))
    get_hub().request_broadcast(visitors=False)
    return {"ok": True}


class DemoBody(BaseModel):
    enabled: bool
    count: int = Field(ge=1, le=200)


@secured.post("/demo")
async def demo(body: DemoBody):
    hub = get_hub()
    hub.state.demo = body.model_dump()
    hub.request_broadcast()
    return {"ok": True}


class ResetBody(BaseModel):
    confirm: Literal["RESET"]


@secured.post("/reset")
async def reset(_: ResetBody):
    await get_hub().reset_day()
    return {"ok": True}


@secured.get("/export.csv")
async def export_csv():
    """Statistiques anonymes : ni pseudo ni identifiant."""
    rows = db.run("SELECT created_at, updated_at, phase, consent FROM visitors ORDER BY created_at", fetch="all")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["arrivee", "duree_min", "derniere_etape", "opt_in_requetes"])
    for r in rows:
        w.writerow([datetime.fromtimestamp(r["created_at"]).strftime("%Y-%m-%d %H:%M"),
                    round((r["updated_at"] - r["created_at"]) / 60, 1), r["phase"], int(r["consent"])])
    name = time.strftime("stats-%Y%m%d.csv")
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


router.include_router(secured)
