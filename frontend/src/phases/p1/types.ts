export interface Character {
  prenom: string; nom: string; naissance: string; ville: string; animal: string; club: string; copain: string;
}
export type PatternCode =
  | "prenom" | "nom" | "date_naissance" | "ville" | "animal" | "club" | "copain"
  | "annee" | "sequence_clavier" | "leet" | "repetition" | "mot_commun" | "schema_maj_annee";

export interface Times { online: number; offline_fast: number; gpu_farm: number }
export interface AuditResult { length: number; score: number; patterns: PatternCode[]; times: Times; guesses: number }
