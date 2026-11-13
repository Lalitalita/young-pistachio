import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { applyTheme } from "./theme";
import type { Me, PublicState, Role, VisitorRow } from "./types";
import { useSocket } from "./useSocket";

/** État de l'événement diffusé par le serveur (visiteur : + « me » ; admin : + liste visiteurs). */
export function useEvent(role: Role, enabled = true) {
  const [state, setState] = useState<PublicState | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);

  const ensureSession = useCallback(async () => { await api("/api/session", "POST"); }, []);

  const { connected, send } = useSocket(
    role,
    (m) => {
      if (m.type === "state") { setState(m.state); if (m.me) setMe(m.me); }
      else if (m.type === "visitors") setVisitors(m.list);
    },
    { enabled, beforeConnect: role === "visitor" ? ensureSession : undefined },
  );

  useEffect(() => { if (state) applyTheme(state.branding); }, [state?.branding]);
  return { state, me, visitors, connected, send };
}
