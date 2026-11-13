"""Bots de démo : simulent des visiteurs (en mémoire, jamais en base) pour tester l'écran."""
import asyncio
import random

from .hub import Hub


async def run(hub: Hub) -> None:
    while True:
        await asyncio.sleep(1.2)
        demo = hub.state.demo
        bots = [v for v in hub.vis.values() if v["bot"]]
        if not demo["enabled"]:
            if bots:
                hub.clear_bots()
            continue
        if len(bots) < demo["count"]:
            for _ in range(min(3, demo["count"] - len(bots))):  # arrivée progressive
                hub.create_visitor(bot=True)
        elif len(bots) > demo["count"]:
            for v in bots[demo["count"]:]:
                del hub.vis[v["id"]]
            hub.request_broadcast()
        for v in bots:
            if random.random() < 0.15:
                hub.advance(v["id"])
