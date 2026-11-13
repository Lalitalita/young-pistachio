import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommon from "@zxcvbn-ts/language-common";
import * as zxcvbnFr from "@zxcvbn-ts/language-fr";

let ready: Promise<void> | null = null;

/** Charge les dictionnaires (FR + commun) une seule fois ; appelé en tâche de fond pendant l'intro. */
export function ensureZxcvbn(): Promise<void> {
  if (!ready) {
    ready = Promise.resolve().then(() => {
      zxcvbnOptions.setOptions({
        dictionary: { ...zxcvbnCommon.dictionary, ...zxcvbnFr.dictionary },
        graphs: zxcvbnCommon.adjacencyGraphs,
        translations: zxcvbnFr.translations,
      });
    });
  }
  return ready;
}

export async function baseGuesses(password: string): Promise<number> {
  await ensureZxcvbn();
  return Number(zxcvbn(password).guesses);
}
