"""SQLite en mode WAL."""
import sqlite3
from pathlib import Path

from .config import settings


def connect() -> sqlite3.Connection:
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(Path(settings.data_dir) / "cyber.db", timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> str:
    """Crée le schéma minimal et renvoie le mode de journal actif."""
    with connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS content_override ("
            " key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        return conn.execute("PRAGMA journal_mode").fetchone()[0]
