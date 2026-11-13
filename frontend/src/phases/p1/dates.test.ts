import { describe, expect, it } from "vitest";
import { allYears, dateVariants } from "./dates";

describe("dateVariants", () => {
  const v = dateVariants("1998-03-12");
  it("contient les formes citées en spécification", () => {
    for (const expected of ["12031998", "1203", "98", "1998", "12/03"]) expect(v).toContain(expected);
  });
  it("contient aussi le format américain et les séparateurs", () => {
    expect(v).toContain("03121998");
    expect(v).toContain("12/03/1998");
    expect(v).toContain("12-03-1998");
    expect(v).toContain("12.03.1998");
  });
  it("aucun doublon", () => expect(new Set(v).size).toBe(v.length));
  it("gère un jour/mois à deux chiffres dès le départ (pas de re-padding)", () => {
    const v2 = dateVariants("2005-01-07");
    expect(v2).toContain("0107");
    expect(v2).toContain("05");
  });
});

describe("allYears", () => {
  it("va de 1950 à l'année donnée", () => {
    const y = allYears(new Date("2026-06-01"));
    expect(y[0]).toBe("1950");
    expect(y[y.length - 1]).toBe("2026");
    expect(y.length).toBe(2026 - 1950 + 1);
  });
});
