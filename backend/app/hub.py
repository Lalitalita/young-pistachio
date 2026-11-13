"""Hub en mémoire : visiteurs, bots, WebSockets (visiteur / écran / admin) et diffusion de l'état.

Un seul process uvicorn : tout l'état temps réel vit ici. Les changements demandent une
diffusion (`request_broadcast`) ; une tâche les regroupe (~120 ms) puis envoie l'état complet,
ce qui donne aussi la resynchronisation gratuite à chaque (re)connexion.
"""
import asyncio
import json
import secrets
import time
from collections import deque

from fastapi import WebSocket

from . import content, db, pseudos, qr
from .phases import PHASES
from .state import EventState

TITLES = {p["id"]: p for p in PHASES}


class Hub:
    def __init__(self) -> None:
        self.state = EventState()
        self.state.load()
        self.vis: dict[str, dict] = {}  # visiteurs réels (persistés) + bots (mémoire)
        self.sockets: dict[str, set[WebSocket]] = {}
        self.screens: set[WebSocket] = set()
        self.admins: set[WebSocket] = set()
        self.recent: deque = deque(maxlen=8)
        self.last_activity = 0.0  # 0 => écran en veille au démarrage
        self.dirty = asyncio.Event()
        self.visitors_dirty = True
        self._last_attract: bool | None = None
        for r in db.run("SELECT * FROM visitors ORDER BY created_at", fetch="all"):
            self.vis[r["id"]] = {"id": r["id"], "pseudo": r["pseudo"], "hidden": bool(r["hidden"]),
                                 "consent": bool(r["consent"]), "phase": r["phase"],
                                 "created_at": r["created_at"], "bot": False}

    # ---------- infrastructure ----------
    def touch(self) -> None:
        self.last_activity = time.time()

    def request_broadcast(self, visitors: bool = True) -> None:
        self.visitors_dirty = self.visitors_dirty or visitors
        self.dirty.set()

    def attract(self) -> bool:
        s = self.state.screen
        if s["mode"] == "attract":
            return True
        return s["attract_after_s"] > 0 and time.time() - self.last_activity > s["attract_after_s"]

    def is_connected(self, vid: str) -> bool:
        v = self.vis.get(vid)
        return bool(v and (v["bot"] or self.sockets.get(vid)))

    # ---------- visiteurs ----------
    def real_count(self) -> int:
        return sum(1 for v in self.vis.values() if not v["bot"])

    def create_visitor(self, bot: bool = False) -> dict:
        taken = {v["pseudo"] for v in self.vis.values()}
        v = {"id": ("bot-" if bot else "") + secrets.token_hex(6), "pseudo": pseudos.generate(taken),
             "hidden": False, "consent": False, "phase": "p0", "created_at": time.time(), "bot": bot}
        self.vis[v["id"]] = v
        if not bot:
            db.run("INSERT INTO visitors(id,pseudo,phase,created_at,updated_at) VALUES(?,?,?,?,?)",
                   (v["id"], v["pseudo"], "p0", v["created_at"], v["created_at"]))
            self.touch()
        self.recent.append(v["id"])
        self.request_broadcast()
        return v

    def _persist(self, v: dict) -> None:
        if not v["bot"]:
            db.run("UPDATE visitors SET pseudo=?,hidden=?,consent=?,phase=?,updated_at=? WHERE id=?",
                   (v["pseudo"], int(v["hidden"]), int(v["consent"]), v["phase"], time.time(), v["id"]))

    def reroll(self, vid: str) -> None:
        v = self.vis[vid]
        v["pseudo"] = pseudos.generate({x["pseudo"] for x in self.vis.values()})
        self._persist(v)
        self.touch()
        self.request_broadcast()

    def set_consent(self, vid: str, consent: bool) -> None:
        self.vis[vid]["consent"] = consent
        self._persist(self.vis[vid])
        self.request_broadcast(visitors=False)

    def moderate(self, vid: str, hidden: bool | None = None, pseudo: str | None = None) -> bool:
        v = self.vis.get(vid)
        if not v:
            return False
        if hidden is not None:
            v["hidden"] = hidden
        if pseudo is not None:
            v["pseudo"] = pseudo
        self._persist(v)
        self.request_broadcast()
        return True

    def advance(self, vid: str) -> None:
        v = self.vis.get(vid)
        nxt = self.state.next_after(v["phase"]) if v else None
        if nxt and (nxt == "end" or nxt in self.state.allowed()):
            self._move(v, nxt)

    def goto(self, vid: str, phase: str) -> None:
        """Visiteur : peut revenir en arrière ou rester sur place, jamais sauter en avant."""
        v = self.vis.get(vid)
        if not v or phase not in self.state.allowed():
            return
        cur, order = v["phase"], self.state.order
        if cur == "end" or (cur in order and order.index(phase) <= order.index(cur)):
            self._move(v, phase)

    def set_phase(self, vid: str, phase: str) -> bool:
        """Admin : place un visiteur (ou bot) sur n'importe quelle étape, sans contrainte."""
        v = self.vis.get(vid)
        if not v or (phase != "end" and phase not in self.state.order):
            return False
        self._move(v, phase)
        return True

    def set_phase_all(self, phase: str) -> int:
        if phase != "end" and phase not in self.state.order:
            return -1
        for v in self.vis.values():
            self._move(v, phase)
        return len(self.vis)

    def _move(self, v: dict, phase: str) -> None:
        v["phase"] = phase
        self._persist(v)
        if not v["bot"]:
            self.touch()
        self.request_broadcast()

    # ---------- bots de démo ----------
    def clear_bots(self) -> None:
        for k in [k for k, v in self.vis.items() if v["bot"]]:
            del self.vis[k]
        self.request_broadcast()

    # ---------- vues sérialisées ----------
    def me(self, vid: str) -> dict:
        v, st = self.vis[vid], self.state
        eo = st.enabled_order()
        nxt = st.next_after(v["phase"])
        order = st.order
        if v["phase"] == "end":
            prev = eo[-1] if eo else None
        else:
            before = [i for i in order[: order.index(v["phase"])] if st.enabled.get(i)] if v["phase"] in order else []
            prev = before[-1] if before else None
        return {"prev": prev, "pseudo": v["pseudo"], "phase": v["phase"], "allowed": st.allowed(), "next": nxt,
                "next_locked": bool(nxt and nxt != "end" and nxt not in st.allowed()),
                "index": eo.index(v["phase"]) if v["phase"] in eo else (len(eo) if v["phase"] == "end" else 0),
                "total": len(eo), "consent": v["consent"]}

    def public_state(self) -> dict:
        st = self.state
        by_phase: dict[str, int] = {}
        connected = 0
        for vid, v in self.vis.items():
            if self.is_connected(vid):
                connected += 1
                by_phase[v["phase"]] = by_phase.get(v["phase"], 0) + 1
        bots = sum(1 for v in self.vis.values() if v["bot"])
        branding = {**content.get_branding(), "logo_url": content.logo_url()}
        return {
            "server_time": time.time(), "mode": st.mode,
            "phases": [{"id": i, "title": TITLES[i]["title"], "tagline": TITLES[i]["tagline"],
                        "enabled": st.enabled[i], "optional": bool(TITLES[i].get("optional")),
                        "params": st.params[i]} for i in st.order],
            "guided_open": st.guided_open, "screen": st.screen, "attract": self.attract(),
            "counts": {"day_total": self.real_count() + bots, "connected": connected, "by_phase": by_phase},
            "branding": branding, "qr": qr.info(st.screen), "demo": st.demo,
            "recent": [{"pseudo": self.vis[i]["pseudo"]} for i in self.recent
                       if i in self.vis and not self.vis[i]["hidden"]],
        }

    def visitor_list(self) -> list[dict]:
        rows = sorted(self.vis.values(), key=lambda v: -v["created_at"])[:300]
        return [{"id": v["id"], "pseudo": v["pseudo"], "hidden": v["hidden"], "phase": v["phase"],
                 "bot": v["bot"], "connected": self.is_connected(v["id"]), "consent": v["consent"]} for v in rows]

    # ---------- WebSockets ----------
    def drop(self, ws: WebSocket) -> None:
        self.screens.discard(ws)
        self.admins.discard(ws)
        for s in self.sockets.values():
            s.discard(ws)

    async def _send(self, ws: WebSocket, text: str):
        try:
            await asyncio.wait_for(ws.send_text(text), 2)
        except Exception:  # client lent ou parti
            return ws
        return None

    async def flush(self) -> None:
        pub = self.public_state()
        pub_json = json.dumps({"type": "state", "state": pub}, ensure_ascii=False)
        items = [(ws, pub_json) for ws in (*self.screens, *self.admins)]
        for vid, wss in self.sockets.items():
            if wss and vid in self.vis:
                txt = json.dumps({"type": "state", "state": pub, "me": self.me(vid)}, ensure_ascii=False)
                items += [(ws, txt) for ws in wss]
        if self.visitors_dirty and self.admins:
            vtxt = json.dumps({"type": "visitors", "list": self.visitor_list()}, ensure_ascii=False)
            items += [(ws, vtxt) for ws in self.admins]
            self.visitors_dirty = False
        for dead in await asyncio.gather(*(self._send(ws, t) for ws, t in items)):
            if dead:
                self.drop(dead)

    async def snapshot(self, ws: WebSocket, vid: str | None = None) -> None:
        msg = {"type": "state", "state": self.public_state()}
        if vid:
            msg["me"] = self.me(vid)
        await ws.send_text(json.dumps(msg, ensure_ascii=False))
        if ws in self.admins:
            await ws.send_text(json.dumps({"type": "visitors", "list": self.visitor_list()}, ensure_ascii=False))

    async def run(self) -> None:
        """Tâche de diffusion groupée + veille (changement d'état d'attract par inactivité)."""
        async def ticker():
            while True:
                await asyncio.sleep(2)
                a = self.attract()
                if a != self._last_attract:
                    self._last_attract = a
                    self.request_broadcast(visitors=False)

        t = asyncio.create_task(ticker())
        try:
            while True:
                await self.dirty.wait()
                await asyncio.sleep(0.12)
                self.dirty.clear()
                await self.flush()
        finally:
            t.cancel()

    # ---------- reset de fin de journée ----------
    async def reset_day(self) -> None:
        db.run("DELETE FROM visitors")
        db.run("DELETE FROM scores")
        stale = [ws for vid, s in self.sockets.items() for ws in s]
        self.vis.clear()
        self.sockets.clear()
        self.recent.clear()
        self.state.guided_open = ["p0"]
        self.state.demo["enabled"] = False
        self.state.save()
        self.last_activity = 0.0
        for ws in stale:  # leurs cookies ne valent plus rien : ils se recréeront une session
            try:
                await ws.send_text('{"type":"no_session"}')
                await ws.close(4401)
            except Exception:
                pass
        self.request_broadcast()


_hub: Hub | None = None


def get_hub() -> Hub:
    assert _hub is not None, "hub non initialisé"
    return _hub


def set_hub(h: Hub | None) -> None:
    global _hub
    _hub = h
