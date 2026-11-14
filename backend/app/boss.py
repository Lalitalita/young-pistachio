"""Moment « boss » : une vraie panne (conteneur coupé par le chaos-agent), vote des visiteurs, redémarrage.

Machine à états : idle -> voting -> recovering -> idle (avec délai minimum entre deux pannes).
Les appels au chaos-agent sont bloquants : ils passent par `asyncio.to_thread`.
"""
import asyncio
import random
import time

from . import chaos, phase3

TARGETS = list(chaos.SERVICES)
RESULT_MIN_S = 8     # le résultat reste affiché au moins ce temps
RECOVER_MAX_S = 60   # au-delà, on repasse en idle quoi qu'il arrive
QUEUE_MAX = 20


class Boss:
    def __init__(self, monitor, clock=time.time, rng: random.Random | None = None,
                 act=chaos.action) -> None:
        self.monitor, self.clock, self.rng, self._act = monitor, clock, rng or random.Random(), act
        self.status = "idle"
        self.cooldown_until = 0.0
        self.queue: list[tuple[str, str]] = []  # (visitor_id, pseudo)
        self.target: str | None = None
        self.by: str | None = None
        self.started_at = 0.0
        self.vote_ends_at = 0.0
        self.recover_since = 0.0
        self.votes: dict[str, int] = {}
        self.real = True
        self.last_error: str | None = None
        self.result: dict | None = None
        self.history: list[dict] = []

    # ---------- actions ----------
    async def _do(self, service: str, act: str) -> None:
        await asyncio.to_thread(self._act, service, act)

    def can_start(self, params: dict, force: bool = False) -> str | None:
        if self.status != "idle":
            return "busy"
        if not force:
            if not params.get("boss_enabled", True):
                return "disabled"
            if self.clock() < self.cooldown_until:
                return "cooldown"
        return None

    async def start(self, params: dict, by: str, target: str | None = None, force: bool = False) -> str | None:
        """Lance la panne. Retourne None si OK, sinon un code d'erreur."""
        err = self.can_start(params, force)
        if err:
            return err
        target = target if target in TARGETS else self.rng.choice(TARGETS)
        self.real = bool(params.get("boss_real", True))
        self.last_error = None
        if self.real:
            try:
                await self._do(target, "stop")
            except chaos.ChaosError as e:
                self.last_error = str(e)
                return "agent"
        else:
            self.monitor.forced_down.add(target)
        now = self.clock()
        self.status, self.target, self.by = "voting", target, by
        self.started_at, self.vote_ends_at = now, now + int(params.get("boss_vote_s", 40))
        self.votes.clear()
        self.result = None
        self.monitor.note(f"🚨 PANNE MAJEURE déclenchée par {by}", "bad")
        return None

    async def request(self, vid: str, pseudo: str, params: dict) -> dict:
        """Demande d'un visiteur : démarre tout de suite si possible, sinon file d'attente."""
        if not params.get("boss_enabled", True):
            return {"state": "disabled"}
        if any(v == vid for v, _ in self.queue):
            return {"state": "queued", "position": [v for v, _ in self.queue].index(vid) + 1}
        if self.status == "idle" and self.clock() >= self.cooldown_until and not self.queue:
            err = await self.start(params, pseudo)
            return {"state": "started"} if err is None else {"state": "error", "reason": err}
        if len(self.queue) >= QUEUE_MAX:
            return {"state": "full"}
        self.queue.append((vid, pseudo))
        return {"state": "queued", "position": len(self.queue)}

    def vote(self, vid: str, choice: int) -> bool:
        n = len(phase3.boss_content()["choices"])
        if self.status != "voting" or not 0 <= choice < n or vid in self.votes:
            return False
        self.votes[vid] = choice
        return True

    def drop_visitor(self, vid: str) -> None:
        self.queue = [(v, p) for v, p in self.queue if v != vid]

    def cancel_queue(self) -> None:
        self.queue.clear()

    async def restore_all(self) -> list[str]:
        """Filet de sécurité : relance les trois services et remet la machine à zéro."""
        errors = []
        for s in TARGETS:
            try:
                await self._do(s, "start")
            except chaos.ChaosError as e:
                errors.append(f"{s}: {e}")
        self.monitor.forced_down.clear()
        if self.status != "idle":
            self._finish()
        return errors

    # ---------- boucle ----------
    def _finish(self) -> None:
        self.status = "idle"
        self.cooldown_until = self.clock() + self._cooldown
        self.monitor.forced_down.discard(self.target or "")

    _cooldown = 120

    async def tick(self, params: dict) -> bool:
        """Fait avancer la machine à états. Retourne True si quelque chose a changé."""
        self._cooldown = int(params.get("boss_cooldown_s", 120))
        now = self.clock()
        if self.status == "voting" and now >= self.vote_ends_at:
            c = phase3.boss_content()
            total = len(self.votes)
            right = sum(1 for v in self.votes.values() if v == c["answer"])
            self.result = {"total": total, "correct": right, "pct": round(100 * right / total) if total else 0,
                           "answer": c["answer"]}
            self.history.append({"target": self.target, "by": self.by, **self.result})
            self.recover_since = now
            self.status = "recovering"
            if self.real:
                try:
                    await self._do(self.target, "start")
                except chaos.ChaosError as e:
                    self.last_error = str(e)
            else:
                self.monitor.forced_down.discard(self.target)
            self.monitor.note("🛠️ Réparation en cours : redémarrage du service", "warn")
            return True
        if self.status == "recovering":
            up = self.monitor.status.get(self.target, {}).get("status") == "up"
            waited = now - self.recover_since
            if (up and waited >= RESULT_MIN_S) or waited >= RECOVER_MAX_S:
                if not up and self.real:  # dernier recours : nouvelle tentative de relance
                    try:
                        await self._do(self.target, "start")
                    except chaos.ChaosError:
                        pass
                self._finish()
                return True
            return False
        if self.status == "idle" and self.queue and now >= self.cooldown_until and params.get("boss_enabled", True):
            vid, pseudo = self.queue.pop(0)
            err = await self.start(params, pseudo)
            if err:
                self.queue.insert(0, (vid, pseudo))
                self.cooldown_until = now + 10  # réessaie un peu plus tard
            return True
        return False

    # ---------- vue publique ----------
    def public(self) -> dict:
        now = self.clock()
        counts = [0] * len(phase3.boss_content()["choices"])
        for v in self.votes.values():
            counts[v] += 1
        return {
            "status": self.status, "target": self.target, "by": self.by, "real": self.real,
            "vote_ends_at": self.vote_ends_at if self.status == "voting" else None,
            "votes": counts, "total_votes": len(self.votes),
            "result": self.result if self.status in ("recovering", "idle") else None,
            "cooldown_s": max(0, round(self.cooldown_until - now)) if self.status == "idle" else 0,
            "queue": [p for _, p in self.queue][:5], "queue_len": len(self.queue),
            "error": self.last_error,
        }
