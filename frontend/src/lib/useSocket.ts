import { useCallback, useEffect, useRef, useState } from "react";
import type { Role, Send } from "./types";

export type { Role };

/** Délai de reconnexion : backoff exponentiel plafonné, avec un peu de jitter. */
export function backoffDelay(attempt: number, base = 500, cap = 15000, rand = Math.random): number {
  const exp = Math.min(cap, base * 2 ** attempt);
  return Math.round(exp / 2 + rand() * (exp / 2));
}

interface Options {
  enabled?: boolean;
  /** Appelé avant chaque (re)connexion (ex. recréer la session visiteur). */
  beforeConnect?: () => Promise<void>;
}

/**
 * WebSocket avec reconnexion automatique. À chaque connexion le serveur renvoie l'état
 * complet : la resynchronisation est donc automatique.
 */
export function useSocket(role: Role, onMessage: (m: any) => void, opts: Options = {}) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const before = useRef(opts.beforeConnect);
  before.current = opts.beforeConnect;
  const enabled = opts.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let hb: number | undefined;
    let attempt = 0;
    let stopped = false;

    const retry = () => { if (!stopped) timer = window.setTimeout(open, backoffDelay(attempt++)); };

    const open = async () => {
      if (stopped) return;
      try { await before.current?.(); } catch { retry(); return; }
      if (stopped) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/api/ws/${role}`);
      wsRef.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        hb = window.setInterval(() => ws.readyState === 1 && ws.send('{"type":"hb"}'), 25000);
      };
      ws.onmessage = (e) => {
        try { handler.current(JSON.parse(e.data)); } catch { /* message ignoré */ }
      };
      ws.onclose = () => {
        clearInterval(hb);
        setConnected(false);
        wsRef.current = null;
        retry();
      };
      ws.onerror = () => ws.close();
    };
    open();
    return () => { stopped = true; clearTimeout(timer); clearInterval(hb); wsRef.current?.close(); };
  }, [role, enabled]);

  const send: Send = useCallback((m) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
  }, []);

  return { connected, send };
}
