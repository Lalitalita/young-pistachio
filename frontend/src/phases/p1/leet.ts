const MAP: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };

/** Normalise le « leet speak » (P@ssw0rd → password) pour la détection de mots du dictionnaire. */
export function normalizeLeet(password: string): string {
  return password.toLowerCase().split("").map((c) => MAP[c] ?? c).join("");
}
