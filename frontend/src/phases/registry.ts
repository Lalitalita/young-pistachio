import { lazy } from "react";
import type { PhasePlugin } from "./types";

// Chargement paresseux par phase : un téléphone ne télécharge que ce dont il a besoin.
const plugin = (mobile: () => Promise<any>, screen: () => Promise<any>, preload?: () => Promise<unknown>): PhasePlugin => ({
  Mobile: lazy(mobile), Screen: lazy(screen), preload: preload ?? mobile,
});

export const PHASES: Record<string, PhasePlugin> = {
  p0: plugin(() => import("./p0/Mobile"), () => import("./p0/Screen")),
  p1: plugin(() => import("./p1/Mobile"), () => import("./p1/Screen"), () => import("./p1/dictionaries").then((m) => m.ensureZxcvbn())),
  p2: plugin(() => import("./p2/Mobile"), () => import("./p2/Screen")),
  p3: plugin(() => import("./p3/Mobile"), () => import("./p3/Screen")),
  p4: plugin(() => import("./p4/Mobile"), () => import("./p4/Screen")),
  end: plugin(() => import("./end/Mobile"), () => import("./end/Screen")),
};

/** Précharge en douceur les phases suivantes (et, plus tard, les dictionnaires de la phase 1). */
export function preloadPhases(ids: string[]): () => void {
  const idle = (window as any).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
  const handle = idle(() => ids.forEach((id) => PHASES[id]?.preload().catch(() => {})));
  return () => ((window as any).cancelIdleCallback ?? clearTimeout)(handle);
}
