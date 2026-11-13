"""QR codes (SVG générés côté serveur, aucune lib front)."""
import io

import segno

from .config import settings


def svg(data: str) -> bytes:
    buf = io.BytesIO()
    segno.make(data, error="m").save(buf, kind="svg", scale=10, border=2,
                                     dark="#0a0a1f", light="#ffffff", xmldecl=False)
    return buf.getvalue()


def _esc(s: str) -> str:
    for ch in ("\\", ";", ",", ":", '"'):
        s = s.replace(ch, "\\" + ch)
    return s


def wifi_payload(ssid: str, password: str, security: str = "WPA") -> str:
    if security.lower() == "nopass" or not password:
        return f"WIFI:T:nopass;S:{_esc(ssid)};;"
    return f"WIFI:T:{security};S:{_esc(ssid)};P:{_esc(password)};;"


def urls(use_host: bool) -> tuple[str, str]:
    """(url principale, url de secours). On n'ajoute :port que s'il n'est pas 80."""
    port = "" if settings.http_port == 80 else f":{settings.http_port}"
    by_host, by_ip = f"http://{settings.parcours_host}{port}", f"http://{settings.pc_ip}{port}"
    return (by_host, by_ip) if use_host else (by_ip, by_host)


def info(screen: dict) -> dict:
    main, alt = urls(screen.get("qr_use_host", False))
    return {"url": main, "alt_url": alt, "ssid": settings.wifi_ssid,
            "wifi": bool(settings.wifi_ssid) and screen.get("show_wifi_qr", True)}
