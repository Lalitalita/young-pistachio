"""État de l'événement (serveur-autoritaire), persisté en base."""
from typing import Any

from . import db, schema
from .phases import BY_ID, IDS, PHASES

DEFAULT_SCREEN = {"mode": "auto", "phase_id": "p1", "rotation_s": 20, "attract_after_s": 90,
                  "show_wifi_qr": True, "qr_use_host": False}
_KEY = "event_state"


class EventState:
    def __init__(self) -> None:
        self.mode = "free"
        self.order: list[str] = list(IDS)
        self.enabled: dict[str, bool] = {i: True for i in IDS}
        self.params: dict[str, dict[str, Any]] = {p["id"]: schema.defaults(p["schema"]) for p in PHASES}
        self.guided_open: list[str] = ["p0"]
        self.screen: dict[str, Any] = dict(DEFAULT_SCREEN)
        self.demo: dict[str, Any] = {"enabled": False, "count": 20}

    # --- persistance ---
    def dump(self) -> dict:
        return {k: getattr(self, k) for k in ("mode", "order", "enabled", "params", "guided_open", "screen")}

    def load(self) -> None:
        d = db.kv_get(_KEY)
        if not d:
            return
        order = [i for i in d.get("order", []) if i in BY_ID]
        self.order = order + [i for i in IDS if i not in order]  # nouvelles phases ajoutées en fin
        self.enabled.update({k: bool(v) for k, v in d.get("enabled", {}).items() if k in BY_ID})
        for pid, vals in d.get("params", {}).items():
            if pid in BY_ID:
                self.params[pid] = schema.validate(BY_ID[pid]["schema"], {**self.params[pid], **vals})
        self.mode = d.get("mode", self.mode) if d.get("mode") in ("free", "guided") else self.mode
        self.guided_open = [i for i in d.get("guided_open", ["p0"]) if i in BY_ID] or ["p0"]
        self.screen.update(d.get("screen", {}))
        self._pin_p0()

    def save(self) -> None:
        db.kv_set(_KEY, self.dump())

    def _pin_p0(self) -> None:
        self.enabled["p0"] = True
        self.order = ["p0"] + [i for i in self.order if i != "p0"]

    # --- règles ---
    def enabled_order(self) -> list[str]:
        return [i for i in self.order if self.enabled.get(i)]

    def allowed(self) -> list[str]:
        """Phases accessibles aux visiteurs (libre : toutes les actives ; guidé : celles ouvertes)."""
        eo = self.enabled_order()
        if self.mode == "free":
            return eo
        return [i for i in eo if i == "p0" or i in self.guided_open]

    def next_after(self, cur: str) -> str | None:
        """Phase suivante (active) après `cur`, ou 'end' ; None si déjà à la fin."""
        if cur == "end":
            return None
        start = self.order.index(cur) + 1 if cur in self.order else 0
        return next((i for i in self.order[start:] if self.enabled.get(i)), "end")

    # --- mutations ---
    def set_phases(self, order: list[str], enabled: dict[str, bool]) -> None:
        if sorted(order) != sorted(IDS) or order[0] != "p0":
            raise schema.SchemaError("Ordre invalide (toutes les phases, Accueil en premier)")
        self.order = order
        self.enabled.update({k: bool(v) for k, v in enabled.items() if k in BY_ID})
        self._pin_p0()

    def set_params(self, pid: str, values: dict) -> None:
        if pid not in BY_ID:
            raise schema.SchemaError("Phase inconnue")
        self.params[pid] = schema.validate(BY_ID[pid]["schema"], {**self.params[pid], **values})

    def open_next(self) -> bool:
        nxt = next((i for i in self.enabled_order() if i not in self.guided_open), None)
        if nxt:
            self.guided_open.append(nxt)
        return nxt is not None

    def close_last(self) -> bool:
        opened = [i for i in self.enabled_order() if i in self.guided_open and i != "p0"]
        if not opened:
            return False
        self.guided_open.remove(opened[-1])
        return True
