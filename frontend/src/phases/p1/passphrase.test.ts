import { describe, expect, it } from "vitest";
import { passphraseGuesses, passphraseWords } from "./passphrase";

describe("passphraseWords", () => {
  it.each([
    ["cheval pomme nuage table", 4], ["cheval-pomme-nuage-table", 4], ["cheval_pomme_nuage", 3],
    ["ChevalPommeNuageTable", 4], ["cheval.pomme.nuage.table.vélo", 5],
  ])("phrase de passe : %s", (p, n) => expect(passphraseWords(p)?.length).toBe(n));
  it.each(["bonjour", "cheval pomme", "cheval-pomme-nuage-42", "Xq7#mK2!wZrT9", "a-b-c-d", "", "motdepasse"])(
    "pas une phrase de passe : %s", (p) => expect(passphraseWords(p)).toBeNull());
  it("chaque mot en plus multiplie la difficulté par 7 776", () => {
    expect(passphraseGuesses(5) / passphraseGuesses(4)).toBeCloseTo(7776);
  });
});
