import { lazy } from "react";
import type { PhasePlugin } from "./types";

// Chargement paresseux par phase : un téléphone ne télécharge que ce dont il a besoin.
const plugin = (mobile: () => Promise<any>, screen: () => Promise<any>): PhasePlugin => ({
  Mobile: lazy(mobile), Screen: lazy(screen),
});

export const PHASES: Record<string, PhasePlugin> = {
  p0: plugin(() => import("./p0/Mobile"), () => import("./p0/Screen")),
  p1: plugin(() => import("./p1/Mobile"), () => import("./p1/Screen")),
  p2: plugin(() => import("./p2/Mobile"), () => import("./p2/Screen")),
  p3: plugin(() => import("./p3/Mobile"), () => import("./p3/Screen")),
  p4: plugin(() => import("./p4/Mobile"), () => import("./p4/Screen")),
  end: plugin(() => import("./end/Mobile"), () => import("./end/Screen")),
};
