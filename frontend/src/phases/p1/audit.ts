import { baseGuesses } from "./dictionaries";
import { combineGuesses, guessesToTimes, scoreFromTime } from "./crack";
import { detectPatterns } from "./maison";
import { passphraseGuesses, passphraseWords } from "./passphrase";
import type { AuditResult, Character, Hint, PatternCode } from "./types";

/** Pièges qui rendent une phrase de passe prévisible, même faite de plusieurs mots. */
const STRONG_PITFALLS: PatternCode[] = [
  "prenom", "nom", "ville", "animal", "club", "copain", "date_naissance", "annee",
  "sequence_clavier", "repetition", "schema_maj_annee",
];

/**
 * Analyse complète d'un mot de passe : tourne sur le téléphone (zxcvbn + règles maison).
 * Phrase de passe (≥ 3 mots sans piège) : on suppose des mots tirés au hasard dans une liste de
 * 7 776 mots ; l'estimation vaut exactement 7 776^n, quel que soit le séparateur (zxcvbn varie énormément selon
 * qu'on met des espaces, des tirets ou des majuscules), ce qui rend les conseils cohérents.
 */
export async function auditPassword(password: string, character: Character, targetYears: number): Promise<AuditResult> {
  const patterns = detectPatterns(password, character);
  let base = password ? await baseGuesses(password) : 1;
  const words = passphraseWords(password)?.length ?? 0;
  const prevPhrase = words >= 3 && !patterns.some((p) => STRONG_PITFALLS.includes(p));
  if (prevPhrase) base = passphraseGuesses(words); // zxcvbn est incohérent selon le séparateur : on fixe la règle
  const guesses = combineGuesses(base, patterns);
  const times = guessesToTimes(guesses);
  const score = scoreFromTime(times.offline_fast, targetYears);
  const reached = times.offline_fast >= targetYears * 365.25 * 86400;
  let hint: Hint = null;
  if (password && !reached) {
    if (patterns.some((p) => STRONG_PITFALLS.includes(p))) hint = "fiche";
    else if (prevPhrase) hint = "add_word";
    else hint = "longer";
  }
  return { length: password.length, score, patterns, times, guesses, words: prevPhrase ? words : 0, hint };
}
