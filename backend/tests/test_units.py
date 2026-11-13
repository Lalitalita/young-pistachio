import random

import pytest

from app import pseudos, qr, schema
from app.security import RateLimiter, make_token, read_token


def test_token_roundtrip_and_tamper():
    t = make_token("visitor", "abc123", now=1000)
    assert read_token("visitor", t, 100, now=1050) == "abc123"
    assert read_token("admin", t, 100, now=1050) is None  # autre usage
    assert read_token("visitor", t, 100, now=1200) is None  # expiré
    assert read_token("visitor", t.replace("abc123", "abc124"), 100, now=1050) is None
    assert read_token("visitor", "n'importe quoi", 100) is None
    assert read_token("visitor", None, 100) is None


def test_rate_limiter_window():
    rl = RateLimiter()
    assert all(rl.allow("k", 3, 10, now=0) for _ in range(3))
    assert not rl.allow("k", 3, 10, now=5)
    assert rl.allow("other", 3, 10, now=5)
    assert rl.allow("k", 3, 10, now=11)  # la fenêtre a glissé


def test_pseudos_unique_and_agree():
    rng = random.Random(1)
    taken: set[str] = set()
    for _ in range(300):
        p = pseudos.generate(taken, rng)
        assert p not in taken
        taken.add(p)
    assert pseudos.generate(set(), random.Random(3))  # non vide
    # accord : Pieuvre (f) → adjectif féminin
    lists = pseudos._lists()
    fem = {a["n"] for a in lists["animals"] if a["g"] == "f"}
    for p in taken:
        n, adj = p.split(" ")[:2]
        if n in fem:
            assert adj in {a["f"] for a in lists["adjectives"]}


def test_pseudo_exhaustion_falls_back_to_number():
    everything = {f"{a['n']} {j[a['g']]}" for a in pseudos._lists()["animals"] for j in pseudos._lists()["adjectives"]}
    p = pseudos.generate(everything, random.Random(0))
    assert p.split(" ")[-1].isdigit()


SCHEMA = [
    {"key": "n", "label": "N", "type": "number", "default": 5, "min": 1, "max": 10, "int": True},
    {"key": "b", "label": "B", "type": "boolean", "default": False},
    {"key": "c", "label": "C", "type": "color", "default": "#aabbcc"},
    {"key": "s", "label": "S", "type": "select", "default": "x", "options": [{"value": "x", "label": "X"}]},
    {"key": "l", "label": "L", "type": "list", "default": [], "max_items": 2,
     "fields": [{"key": "t", "label": "T", "type": "string", "default": ""}]},
]


def test_schema_defaults_and_validate():
    assert schema.defaults(SCHEMA)["n"] == 5
    out = schema.validate(SCHEMA, {"n": 3.0, "c": "#AABBCC", "inconnu": 1})
    assert out == {"n": 3, "b": False, "c": "#aabbcc", "s": "x", "l": []}


@pytest.mark.parametrize("bad", [{"n": 0}, {"n": "3"}, {"n": True}, {"b": 1}, {"c": "rouge"},
                                 {"s": "y"}, {"l": [{}, {}, {}]}, {"l": "x"}])
def test_schema_rejects(bad):
    with pytest.raises(schema.SchemaError):
        schema.validate(SCHEMA, bad)


def test_wifi_payload_escaping():
    got = qr.wifi_payload("Mon;Wifi", 'p;a:s,s"\\', "WPA")
    assert got == r'WIFI:T:WPA;S:Mon\;Wifi;P:p\;a\:s\,s\"\\;;'
    assert qr.wifi_payload("Ouvert", "", "WPA") == "WIFI:T:nopass;S:Ouvert;;"


def test_qr_svg():
    assert qr.svg("http://x").startswith(b"<svg")
