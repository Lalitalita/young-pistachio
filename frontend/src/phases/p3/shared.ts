import { useEffect, useRef, useState } from "react";
import type { Bilingual } from "../../lib/types";
import type { Mode } from "../../lib/richtext";

/** Variante curieux/expert d'un texte venant des fichiers de contenu (chaîne simple ou {curious, expert}). */
export function pick(v: Bilingual | undefined, mode: Mode): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : v[mode];
}

/** Secondes restantes avant `endsAt` (heure serveur), en corrigeant le décalage d'horloge de l'appareil. */
export function useCountdown(endsAt: number | null, serverTime: number): number {
  const skew = useRef(0);
  skew.current = serverTime * 1000 - Date.now();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t); }, []);
  if (endsAt === null) return 0;
  return Math.max(0, Math.ceil((endsAt * 1000 - (Date.now() + skew.current)) / 1000));
}

/** Pourcentage de chaque option dans un vote. */
export function votePercents(votes: number[]): number[] {
  const total = votes.reduce((a, b) => a + b, 0);
  return votes.map((v) => (total ? Math.round((100 * v) / total) : 0));
}

export const STATUS_LABEL: Record<string, string> = {
  up: "En ligne", degraded: "Dégradé", down: "EN PANNE", unknown: "Non surveillé",
};
