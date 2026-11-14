import type { PatternCode, Times } from "./types";

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Plafond (nombre d'essais) qu'un piège rend plausible, indépendamment de l'estimation de base. */
const ABSOLUTE_CAPS: Partial<Record<PatternCode, number>> = {
  prenom: 50, nom: 50, ville: 50, animal: 50, club: 50, copain: 50,
  date_naissance: 30, annee: 300, sequence_clavier: 200, repetition: 500,
};
/** Pièges qui réduisent l'estimation de base d'un facteur, plutôt qu'un plafond absolu. */
const RELATIVE_FACTORS: Partial<Record<PatternCode, number>> = { schema_maj_annee: 200, leet: 10, mot_commun: 20 };

/**
 * Combine l'estimation de base (zxcvbn) avec les pièges « maison » détectés : chaque piège ne
 * peut que réduire l'estimation (jamais l'augmenter), car il représente une attaque moins chère
 * qu'un attaquant informé essaierait en priorité.
 */
export function combineGuesses(baseGuesses: number, patterns: PatternCode[]): number {
  let g = Math.max(1, baseGuesses);
  for (const p of patterns) {
    const cap = ABSOLUTE_CAPS[p];
    if (cap !== undefined) g = Math.min(g, cap);
    const factor = RELATIVE_FACTORS[p];
    if (factor !== undefined) g = Math.min(g, Math.max(1, baseGuesses / factor));
  }
  return g;
}

/** Trois profils d'attaquant (ordres de grandeur pédagogiques), en essais par seconde. */
export const ATTACKER_RATES = { online: 100 / 3600, offline_fast: 1e10, gpu_farm: 1e12 };

/** Temps de cassage moyen (la moitié de l'espace à explorer) pour chaque profil, en secondes. */
export function guessesToTimes(guesses: number): Times {
  const avg = guesses / 2;
  return {
    online: avg / ATTACKER_RATES.online,
    offline_fast: avg / ATTACKER_RATES.offline_fast,
    gpu_farm: avg / ATTACKER_RATES.gpu_farm,
  };
}

/** Score 0–100 selon le temps de cassage (profil « hors ligne, hash rapide ») face à l'objectif. */
export function scoreFromTime(seconds: number, targetYears: number): number {
  if (seconds <= 0 || targetYears <= 0) return 0;
  const ratio = seconds / (targetYears * 365.25 * 86400);
  const score = ratio >= 1 ? 70 + 30 * (1 - 1 / (1 + Math.log10(ratio))) : 70 * Math.log10(1 + 9 * ratio);
  return Math.round(clamp(score, 0, 100));
}
