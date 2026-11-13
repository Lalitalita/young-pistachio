import { COMMON_WORDS } from "./commonWords";
import { allYears, dateVariants } from "./dates";
import { hasKeyboardSequence } from "./keyboard";
import { normalizeLeet } from "./leet";
import type { Character, PatternCode } from "./types";

const FICHE_FIELD: Record<string, PatternCode> = {
  prenom: "prenom", nom: "nom", ville: "ville", animal: "animal", club: "club", copain: "copain",
};

function includesCI(haystackLower: string, needle: string): boolean {
  return needle.length >= 3 && haystackLower.includes(needle.toLowerCase());
}

/** Répétition d'un caractère (aaa) ou d'un petit bloc (abab, 123123). */
export function hasRepetition(password: string): boolean {
  return /(.)\1{2,}/.test(password) || /(.{2,4})\1+/.test(password);
}

/** Schéma archi-répandu « Majuscule + mot + année + signe final ». */
export function hasMajusculeMotAnneeSchema(password: string): boolean {
  return /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]{2,}\d{2,4}[!?.]?$/.test(password);
}

/**
 * Détecte tous les pièges « maison » (infos de la fiche, dates, clavier, leet, répétitions,
 * mots courants, schéma classique). Vérifie à la fois le mot de passe brut et sa version
 * normalisée « leet speak » ; si seule la version normalisée matche, ajoute aussi `leet`.
 */
export function detectPatterns(password: string, character: Character, now: Date = new Date()): PatternCode[] {
  const lower = password.toLowerCase();
  const normalized = normalizeLeet(password);
  const found = new Set<PatternCode>();
  let leetOnly = false;

  for (const [field, code] of Object.entries(FICHE_FIELD)) {
    const value = (character as any)[field] as string;
    const rawHit = includesCI(lower, value);
    const leetHit = !rawHit && includesCI(normalized, value);
    if (rawHit || leetHit) {
      found.add(code);
      leetOnly = leetOnly || leetHit;
    }
  }

  if (dateVariants(character.naissance).some((v) => lower.includes(v.toLowerCase()))) {
    found.add("date_naissance");
  }
  const birthYear = character.naissance.slice(0, 4);
  if (allYears(now).some((y) => y !== birthYear && lower.includes(y))) {
    found.add("annee");
  }
  if (hasKeyboardSequence(password)) found.add("sequence_clavier");
  if (hasRepetition(password)) found.add("repetition");
  if (hasMajusculeMotAnneeSchema(password)) found.add("schema_maj_annee");

  for (const w of COMMON_WORDS) {
    const rawHit = includesCI(lower, w);
    const leetHit = !rawHit && includesCI(normalized, w);
    if (rawHit || leetHit) {
      found.add("mot_commun");
      leetOnly = leetOnly || leetHit;
      break;
    }
  }
  if (leetOnly) found.add("leet");

  return [...found];
}
