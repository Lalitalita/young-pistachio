"""SQLite en mode WAL. Aucune donnée réelle : pseudos aléatoires et progression seulement."""
import json
import sqlite3
from pathlib import Path
from typing import Any

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY, pseudo TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0,
  consent INTEGER NOT NULL DEFAULT 0, phase TEXT NOT NULL DEFAULT 'p0',
  created_at REAL NOT NULL, updated_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT, phase TEXT NOT NULL, visitor_id TEXT NOT NULL,
  value REAL NOT NULL, data TEXT, created_at REAL NOT NULL);
"""


def connect() -> sqlite3.Connection:
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(Path(settings.data_dir) / "cyber.db", timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def run(sql: str, args: tuple = (), fetch: str | None = None) -> Any:
    conn = connect()
    try:
        cur = conn.execute(sql, args)
        res = cur.fetchall() if fetch == "all" else cur.fetchone() if fetch == "one" else None
        conn.commit()
        return res
    finally:
        conn.close()


def init_db() -> str:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        return conn.execute("PRAGMA journal_mode").fetchone()[0]
    finally:
        conn.close()


def kv_get(key: str, default: Any = None) -> Any:
    row = run("SELECT value FROM kv WHERE key=?", (key,), "one")
    return json.loads(row["value"]) if row else default


def kv_set(key: str, value: Any) -> None:
    run("INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, json.dumps(value, ensure_ascii=False)))


def kv_delete(key: str) -> None:
    run("DELETE FROM kv WHERE key=?", (key,))


def kv_delete_prefix(prefix: str) -> None:
    run("DELETE FROM kv WHERE key LIKE ? ESCAPE '\\'",
        (prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%",))
