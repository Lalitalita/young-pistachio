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
  it("4 mots au hasard : ordre de grandeur cohérent (2 jours hors ligne), séparateurs sans effet", async () => {
    const times = [];
    for (const p of ["cheval pomme nuage table", "cheval-pomme-nuage-table", "ChevalPommeNuageTable"]) {
      const r = await auditPassword(p, CHAR, 10);
      expect(r.words).toBe(4);
      expect(r.patterns).toEqual([]);
      times.push(r.times.offline_fast);
    }
    for (const t of times) { expect(t).toBeGreaterThan(3600 * 24); expect(t).toBeLessThan(3600 * 24 * 10); }
  });
  it("5 mots au hasard atteignent un objectif de 10 ans, 4 mots non (conseil : ajouter un mot)", async () => {
    const four = await auditPassword("cheval pomme nuage table", CHAR, 10);
    const five = await auditPassword("cheval pomme nuage table lampe", CHAR, 10);
    expect(four.hint).toBe("add_word");
    expect(five.times.offline_fast).toBeGreaterThan(10 * 365.25 * 86400);
    expect(five.hint).toBeNull();
  });
  it("une phrase avec le prénom du personnage n'est pas sauvée par le nombre de mots", async () => {
    const r = await auditPassword("lea chat marseille vacances", CHAR, 10);
    expect(r.words).toBe(0);
    expect(r.hint).toBe("fiche");
    expect(r.times.offline_fast).toBeLessThan(1);
  });
  it("4 mots sans rapport ne sont jamais piégés, même si un mot cache le prénom du copain", async () => {
    const eva = { ...CHAR, copain: "Eva" };
    const r = await auditPassword("cheval pomme nuage table", eva, 10);
    expect(r.patterns).toEqual([]);
    expect(r.words).toBe(4);
  });
});
