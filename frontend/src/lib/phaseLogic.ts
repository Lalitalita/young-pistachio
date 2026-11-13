import type { PublicState } from "./types";

export type ScreenView = { kind: "attract" } | { kind: "phase"; id: string };

/** Phase affichée en rotation automatique (déterministe selon l'heure). */
export function pickRotation(ids: string[], nowMs: number, rotationS: number): string | null {
  if (!ids.length) return null;
  return ids[Math.floor(nowMs / 1000 / Math.max(1, rotationS)) % ids.length];
}

/** Que montre le grand écran ? Veille, phase fixée par l'admin, ou rotation. */
export function screenView(s: PublicState, nowMs: number): ScreenView {
  if (s.attract) return { kind: "attract" };
  const enabled = s.phases.filter((p) => p.enabled).map((p) => p.id);
  if (!enabled.length) return { kind: "attract" };
  if (s.screen.mode === "phase") {
    return { kind: "phase", id: enabled.includes(s.screen.phase_id) ? s.screen.phase_id : enabled[0] };
  }
  return { kind: "phase", id: pickRotation(enabled, nowMs, s.screen.rotation_s)! };
}
