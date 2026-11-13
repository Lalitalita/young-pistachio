import { describe, expect, it } from "vitest";
import { parseRich, pickText } from "./richtext";

describe("pickText", () => {
  const texts = { a: "simple", b: { curious: "doux", expert: "technique" } };
  it("texte unique : identique dans les deux modes", () => {
    expect(pickText(texts, "a", "curious")).toBe("simple");
    expect(pickText(texts, "a", "expert")).toBe("simple");
  });
  it("variantes", () => {
    expect(pickText(texts, "b", "curious")).toBe("doux");
    expect(pickText(texts, "b", "expert")).toBe("technique");
  });
  it("clé absente → repli", () => {
    expect(pickText(texts, "zz", "curious")).toBe("");
    expect(pickText(texts, "zz", "curious", "x")).toBe("x");
  });
});

describe("parseRich", () => {
  it("texte sans marqueur", () => expect(parseRich("bonjour")).toEqual([{ type: "text", text: "bonjour" }]));
  it("terme avec libellé", () =>
    expect(parseRich("un [[dns|DNS]] ici")).toEqual([
      { type: "text", text: "un " }, { type: "term", key: "dns", label: "DNS" }, { type: "text", text: " ici" },
    ]));
  it("terme sans libellé, en début et fin", () =>
    expect(parseRich("[[ip]] et [[hash]]")).toEqual([
      { type: "term", key: "ip", label: undefined }, { type: "text", text: " et " }, { type: "term", key: "hash", label: undefined },
    ]));
  it("ignore les marqueurs invalides", () => expect(parseRich("[[Pas Valide]]")).toEqual([{ type: "text", text: "[[Pas Valide]]" }]));
  it("chaîne vide", () => expect(parseRich("")).toEqual([]));
});
