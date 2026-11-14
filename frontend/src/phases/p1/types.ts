export interface Character {
  prenom: string; nom: string; naissance: string; ville: string; animal: string; club: string; copain: string;
}
export type PatternCode =
  | "prenom" | "nom" | "date_naissance" | "ville" | "animal" | "club" | "copain"
  | "annee" | "sequence_clavier" | "leet" | "repetition" | "mot_commun" | "schema_maj_annee";

export interface Times { online: number; offline_fast: number; gpu_farm: number }
export type Hint = "fiche" | "add_word" | "longer" | null;
export interface AuditResult {
  length: number; score: number; patterns: PatternCode[]; times: Times; guesses: number;
  /** Nombre de mots si c'est une phrase de passe (sinon 0) et conseil adapté à ce qui bloque. */
  words: number; hint: Hint;
}
