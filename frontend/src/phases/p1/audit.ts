import { baseGuesses } from "./dictionaries";
import { combineGuesses, guessesToTimes, scoreFromTime } from "./crack";
import { detectPatterns } from "./maison";
import type { AuditResult, Character } from "./types";

/** Analyse complète d'un mot de passe : tourne entièrement côté client, rien n'est envoyé ici. */
export async function auditPassword(password: string, character: Character, targetYears: number): Promise<AuditResult> {
  const patterns = detectPatterns(password, character);
  const base = password ? await baseGuesses(password) : 1;
  const guesses = combineGuesses(base, patterns);
  const times = guessesToTimes(guesses);
  return { length: password.length, score: scoreFromTime(times.offline_fast, targetYears), patterns, times, guesses };
}
