import { describe, expect, it } from "vitest";
import { combineGuesses, guessesToTimes, scoreFromTime } from "./crack";
import type { PatternCode } from "./types";

describe("combineGuesses", () => {
  it("sans piège : renvoie l'estimation de base", () => expect(combineGuesses(1e12, [])).toBe(1e12));
  it("un piège direct plafonne fortement", () => expect(combineGuesses(1e12, ["prenom"])).toBeLessThanOrEqual(50));
  it("plusieurs pièges : prend le minimum (le plus favorable à l'attaquant)", () => {
    const g = combineGuesses(1e12, ["prenom", "date_naissance"]);
    expect(g).toBeLessThanOrEqual(30);
  });
  it("jamais en dessous de 1", () => expect(combineGuesses(0, ["prenom"])).toBeGreaterThanOrEqual(1));
  it("un piège ne peut jamais AUGMENTER l'estimation", () => {
    const base = 42;
    for (const p of ["prenom", "sequence_clavier", "leet", "mot_commun"] as PatternCode[]) {
      expect(combineGuesses(base, [p])).toBeLessThanOrEqual(base);
    }
  });
  it("facteur relatif (schema_maj_annee) réduit proportionnellement à la base", () => {
    expect(combineGuesses(2_000_000, ["schema_maj_annee"])).toBe(10_000);
  });
});

describe("guessesToTimes", () => {
  it("ordonne toujours en ligne > hors ligne > ferme de GPU, pour les mêmes essais", () => {
    const t = guessesToTimes(1e15);
    expect(t.online).toBeGreaterThan(t.offline_fast);
    expect(t.offline_fast).toBeGreaterThan(t.gpu_farm);
  });
  it("croît avec le nombre d'essais", () => {
    expect(guessesToTimes(1e10).online).toBeLessThan(guessesToTimes(1e12).online);
  });
  it("un seul essai : temps très court partout", () => {
    const t = guessesToTimes(1);
    expect(t.gpu_farm).toBeLessThan(1e-9);
  });
});

describe("scoreFromTime", () => {
  it("temps nul ou cible nulle -> 0", () => {
    expect(scoreFromTime(0, 10)).toBe(0);
    expect(scoreFromTime(1000, 0)).toBe(0);
  });
  it("croît avec le temps de cassage (monotone)", () => {
    const target = 10;
    let prev = -1;
    for (const s of [1, 60, 3600, 86400, 1e6, 1e9, 1e12, 1e20]) {
      const sc = scoreFromTime(s, target);
      expect(sc).toBeGreaterThanOrEqual(prev);
      prev = sc;
    }
  });
  it("reste entre 0 et 100", () => {
    for (const s of [0, 1, 1e50]) expect(scoreFromTime(s, 10)).toBeGreaterThanOrEqual(0);
    expect(scoreFromTime(1e50, 10)).toBeLessThanOrEqual(100);
  });
  it("atteindre pile l'objectif donne un score élevé mais pas parfait", () => {
    const years = 10;
    const sc = scoreFromTime(years * 365.25 * 86400, years);
    expect(sc).toBeGreaterThanOrEqual(65);
    expect(sc).toBeLessThan(100);
  });
});
