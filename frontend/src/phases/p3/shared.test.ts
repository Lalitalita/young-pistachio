import { describe, expect, it } from "vitest";
import { pick, votePercents } from "./shared";

describe("p3 shared", () => {
  it("pick choisit la variante selon le mode", () => {
    expect(pick({ curious: "simple", expert: "tech" }, "curious")).toBe("simple");
    expect(pick({ curious: "simple", expert: "tech" }, "expert")).toBe("tech");
    expect(pick("même texte", "expert")).toBe("même texte");
    expect(pick(undefined, "curious")).toBe("");
  });
  it("votePercents gère zéro vote et les arrondis", () => {
    expect(votePercents([0, 0, 0])).toEqual([0, 0, 0]);
    expect(votePercents([1, 1, 0])).toEqual([50, 50, 0]);
    expect(votePercents([3, 1, 0])).toEqual([75, 25, 0]);
  });
});
