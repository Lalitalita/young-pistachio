"""API de démo (phase 3) : dépend de demo-db, comme une vraie application."""
import json
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def db_up() -> bool:
    try:
        socket.create_connection(("demo-db", 5432), timeout=1.5).close()
        return True
    except OSError:
        return False


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/health":
            up = db_up()
            code, body = (200, {"status": "ok"}) if up else (503, {"status": "degraded", "db": "down"})
        else:
            code, body = 200, {"produits": ["Clavier", "Souris", "Écran"]}
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


ThreadingHTTPServer(("0.0.0.0", 8080), H).serve_forever()
