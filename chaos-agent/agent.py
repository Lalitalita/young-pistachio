"""Squelette du chaos-agent (étape 4 : allowlist, stop/start, jeton, rate limit)."""
from http.server import BaseHTTPRequestHandler, HTTPServer


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if self.path == "/health" else 404)
        self.end_headers()
        self.wfile.write(b"ok" if self.path == "/health" else b"")


HTTPServer(("0.0.0.0", 9000), H).serve_forever()
