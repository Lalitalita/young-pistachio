import { describe, expect, it } from "vitest";
import { normalizeLeet } from "./leet";

describe("normalizeLeet", () => {
  it("remplace les substitutions courantes", () => expect(normalizeLeet("P@ssw0rd")).toBe("password"));
  it("gère plusieurs substitutions", () => expect(normalizeLeet("M4rs3ille")).toBe("marseille"));
  it("laisse les caractères inconnus tels quels", () => expect(normalizeLeet("Test_xyz")).toBe("test_xyz"));
  it("ne change rien à un mot sans leet", () => expect(normalizeLeet("Bonjour")).toBe("bonjour"));
});
