import { useEffect, useRef, useState } from "react";

export type Role = "visitor" | "screen" | "admin";

/** Délai de reconnexion : backoff exponentiel plafonné, avec un peu de jitter. */
export function backoffDelay(attempt: number, base = 500, cap = 15000, rand = Math.random): number {
  const exp = Math.min(cap, base * 2 ** attempt);
  return Math.round(exp / 2 + rand() * (exp / 2));
}

/** WebSocket avec reconnexion automatique. `onMessage` est appelé pour chaque message JSON. */
export function useSocket(role: Role, onMessage?: (m: any) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: number | undefined;
    let attempt = 0;
    let stopped = false;

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws/${role}`);
      ws.onopen = () => { attempt = 0; setConnected(true); };
      ws.onmessage = (e) => {
        try { handler.current?.(JSON.parse(e.data)); } catch { /* message ignoré */ }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) timer = window.setTimeout(open, backoffDelay(attempt++));
      };
      ws.onerror = () => ws?.close();
    };
    open();
    return () => { stopped = true; clearTimeout(timer); ws?.close(); };
  }, [role]);

  return connected;
}
