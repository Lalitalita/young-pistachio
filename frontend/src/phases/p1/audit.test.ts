import { describe, expect, it } from "vitest";
import { auditPassword } from "./audit";
import type { Character } from "./types";

const CHAR: Character = { prenom: "Lea", nom: "Martin", naissance: "1998-03-12", ville: "Avignon", animal: "Chat", club: "PSG", copain: "Hugo" };

describe("auditPassword (intégration zxcvbn + couche maison)", () => {
  it("un mot de passe basé sur la fiche est très faible", async () => {
    const r = await auditPassword("lea1998", CHAR, 10);
    expect(r.patterns).toContain("prenom");
    expect(r.score).toBeLessThan(20);
    expect(r.length).toBe(7);
  });
  it("une phrase de passe aléatoire obtient un score nettement meilleur", async () => {
    const weak = await auditPassword("lea1998", CHAR, 10);
    const strong = await auditPassword("corail-tempete-manivelle-42z", CHAR, 10);
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.patterns).toEqual([]);
  });
  it("mot de passe vide : ne plante pas", async () => {
    const r = await auditPassword("", CHAR, 10);
    expect(r.length).toBe(0);
    expect(r.score).toBe(0);
  });
});
