/** Taille de la liste de mots supposée pour une phrase de passe (standard « Diceware » : 6 dés = 7 776 mots). */
export const WORDLIST_SIZE = 7776;

const LETTERS = /^\p{L}{3,}$/u;

/**
 * Détecte une phrase de passe faite de mots séparés (espaces, tirets, points, underscores…)
 * ou collés en « MajusculesCollées ». Renvoie les mots, ou null si ce n'en est pas une.
 * Il faut au moins 3 mots de 3 lettres ou plus, sans aucun chiffre ni symbole.
 */
export function passphraseWords(password: string): string[] | null {
  const parts = password.trim().split(/[\s\-_.,;+/]+/u).filter(Boolean);
  let words = parts;
  if (parts.length === 1) {
    const camel = password.match(/\p{Lu}\p{Ll}+/gu);
    if (camel && camel.join("") === password) words = camel;
  }
  return words.length >= 3 && words.every((w) => LETTERS.test(w)) ? words : null;
}

/** Essais nécessaires si les mots sont tirés au hasard dans une liste de 7 776 mots. */
export function passphraseGuesses(wordCount: number): number {
  return WORDLIST_SIZE ** wordCount;
}
