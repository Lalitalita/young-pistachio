import { describe, expect, it } from "vitest";
import { mixHex } from "./theme";

describe("mixHex", () => {
  it("renvoie les extrémités", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
  });
  it("mélange au milieu", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
