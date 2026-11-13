import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("instantané sous la seconde", () => expect(formatDuration(0.2)).toBe("instantané"));
  it.each([
    [5, "s"], [90, "min"], [7200, "h"], [3 * 86400, "jours"],
  ])("unité adaptée pour %i s", (s, unit) => expect(formatDuration(s)).toContain(unit));
  it("des années pour un temps long", () => expect(formatDuration(5 * 365.25 * 86400)).toContain("ans"));
  it("plafonne à l'âge de l'univers pour un temps astronomique", () => {
    expect(formatDuration(1e40)).toContain("univers");
    expect(formatDuration(Infinity)).toContain("univers");
  });
  it("jamais négatif ni NaN dans la sortie", () => {
    for (const s of [1, 100, 1e6, 1e12]) expect(formatDuration(s)).not.toMatch(/-|NaN/);
  });
});
