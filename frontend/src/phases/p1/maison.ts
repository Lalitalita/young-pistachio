import { COMMON_WORDS } from "./commonWords";
import { allYears, dateVariants } from "./dates";
import { hasKeyboardSequence } from "./keyboard";
import { normalizeLeet } from "./leet";
import type { Character, PatternCode } from "./types";

const FICHE_FIELD: Record<string, PatternCode> = {
  prenom: "prenom", nom: "nom", ville: "ville", animal: "animal", club: "club", copain: "copain",
};

/**
 * Le mot (déjà en minuscules côté `haystackLower`) est-il présent ? Les noms longs (≥ 5 lettres) comptent
 * n'importe où ; les noms courts (« Eva », « Lea », « PSG ») seulement s'ils ne sont pas enfouis dans
 * un autre mot : début/fin du mot de passe, ou collés à un chiffre, un tiret, un espace…
 * (sinon « che-val » contiendrait « Eva » et une belle phrase de passe serait jugée piégée).
 */
function includesCI(haystackLower: string, needle: string): boolean {
  const n = needle.toLowerCase();
  if (n.length < 3) return false;
  if (n.length >= 5) return haystackLower.includes(n);
  const isLetter = (c: string | undefined) => c !== undefined && /\p{L}/u.test(c);
  for (let i = haystackLower.indexOf(n); i !== -1; i = haystackLower.indexOf(n, i + 1)) {
    if (!isLetter(haystackLower[i - 1]) || !isLetter(haystackLower[i + n.length])) return true;
  }
  return false;
}

/** Mots entiers d'un mot de passe (coupé aux séparateurs, chiffres et majuscules), en minuscules sans accents. */
function tokens(text: string): Set<string> {
  const strip = (w: string) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const out = new Set<string>();
  for (const chunk of text.split(/[^\p{L}]+/u)) {
    if (!chunk) continue;
    out.add(strip(chunk));
    for (const w of chunk.match(/\p{Lu}?\p{Ll}+|\p{Lu}+(?!\p{Ll})/gu) ?? []) out.add(strip(w));
  }
  return out;
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

  const rawTokens = tokens(password);
  const leetTokens = tokens(normalized);
  for (const w of COMMON_WORDS) {
    const rawHit = rawTokens.has(w);
    const leetHit = !rawHit && leetTokens.has(w);
    if (rawHit || leetHit) {
      found.add("mot_commun");
      leetOnly = leetOnly || leetHit;
      break;
    }
  }
  if (leetOnly) found.add("leet");

  return [...found];
}
