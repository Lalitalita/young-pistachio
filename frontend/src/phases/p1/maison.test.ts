import { describe, expect, it } from "vitest";
import { detectPatterns, hasMajusculeMotAnneeSchema, hasRepetition } from "./maison";
import type { Character } from "./types";

const CHAR: Character = { prenom: "Lea", nom: "Martin", naissance: "1998-03-12", ville: "Avignon", animal: "Chat", club: "PSG", copain: "Hugo" };
const NOW = new Date("2026-01-01");

describe("hasRepetition", () => {
  it.each(["aaab", "xx121212", "abab1234", "xyzabcabc"])("positif : %s", (p) => expect(hasRepetition(p)).toBe(true));
  it.each(["Xq7mK2wZ9", "bonjour", "motpassedesecurite"])("négatif : %s", (p) => expect(hasRepetition(p)).toBe(false));
});

describe("hasMajusculeMotAnneeSchema", () => {
  it.each(["Marseille2024!", "Avignon98", "Coucou2020."])("positif : %s", (p) => expect(hasMajusculeMotAnneeSchema(p)).toBe(true));
  it.each(["marseille2024", "2024Marseille", "Xq7mK2wZ9"])("négatif : %s", (p) => expect(hasMajusculeMotAnneeSchema(p)).toBe(false));
});

describe("detectPatterns : infos de la fiche", () => {
  it("prénom", () => expect(detectPatterns("lea2024", CHAR, NOW)).toContain("prenom"));
  it("nom", () => expect(detectPatterns("martin!", CHAR, NOW)).toContain("nom"));
  it("ville", () => expect(detectPatterns("avignon84", CHAR, NOW)).toContain("ville"));
  it("animal", () => expect(detectPatterns("chatchat", CHAR, NOW)).toContain("animal"));
  it("club", () => expect(detectPatterns("psgforever", CHAR, NOW)).toContain("club"));
  it("copain/copine", () => expect(detectPatterns("hugoetlea", CHAR, NOW)).toContain("copain"));
  it("aucune fausse détection sur un mot de passe sans rapport", () => {
    const p = detectPatterns("Xq7#mK2!wZrT9", CHAR, NOW);
    expect(p).not.toContain("prenom"); expect(p).not.toContain("nom"); expect(p).not.toContain("ville");
  });
});

describe("detectPatterns : dates et années", () => {
  it("date de naissance complète", () => expect(detectPatterns("x12031998x", CHAR, NOW)).toContain("date_naissance"));
  it("date de naissance courte (jjmm)", () => expect(detectPatterns("test1203", CHAR, NOW)).toContain("date_naissance"));
  it("année générique autre que la naissance", () => expect(detectPatterns("bonjour2024", CHAR, NOW)).toContain("annee"));
  it("l'année de naissance seule compte comme date, pas comme année générique en double", () => {
    const p = detectPatterns("xx1998xx", CHAR, NOW);
    expect(p).toContain("date_naissance");
    expect(p).not.toContain("annee");
  });
});

describe("detectPatterns : leet speak", () => {
  it("détecte le prénom et le leet quand seule la forme normalisée matche", () => {
    const p = detectPatterns("L3a2024!", CHAR, NOW); // "l3a" -> "lea" seulement après normalisation
    expect(p).toContain("prenom"); expect(p).toContain("leet");
  });
  it("ne marque pas leet si le mot est déjà présent en clair", () => {
    const p = detectPatterns("lea2024!", CHAR, NOW);
    expect(p).toContain("prenom"); expect(p).not.toContain("leet");
  });
});

describe("detectPatterns : mot courant et clavier", () => {
  it("mot courant générique (non lié à la fiche)", () => expect(detectPatterns("chocolat99", CHAR, NOW)).toContain("mot_commun"));
  it("suite clavier", () => expect(detectPatterns("azerty99", CHAR, NOW)).toContain("sequence_clavier"));
  it("répétition", () => expect(detectPatterns("xx121212", CHAR, NOW)).toContain("repetition"));
  it("schéma classique", () => expect(detectPatterns("Avignon2024!", CHAR, NOW)).toContain("ville"));
});

describe("detectPatterns : mot de passe solide", () => {
  it("ne détecte aucun piège sur un mot de passe aléatoire sans rapport", () => {
    expect(detectPatterns("Qx7!bN2#mWvJ9zL", CHAR, NOW)).toEqual([]);
  });
});
