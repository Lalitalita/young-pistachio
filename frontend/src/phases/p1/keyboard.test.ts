import { describe, expect, it } from "vitest";
import { hasKeyboardSequence } from "./keyboard";

describe("hasKeyboardSequence", () => {
  it.each(["azerty", "AZERTY123", "qwerty", "aqwzsx", "qsdfghjklm", "poiuyt"])("détecte %s", (p) => {
    expect(hasKeyboardSequence(p)).toBe(true);
  });
  it("détecte une suite à l'envers", () => expect(hasKeyboardSequence("ytreza")).toBe(true));
  it("ne déclenche pas sur un mot de passe sans suite", () => expect(hasKeyboardSequence("Xq7#mK2!wZ")).toBe(false));
  it("ignore une suite trop courte", () => expect(hasKeyboardSequence("aze")).toBe(false));
});
