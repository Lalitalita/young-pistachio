export type Mode = "curious" | "expert";
export type TextValue = string | { curious: string; expert: string };
export type Part = { type: "text"; text: string } | { type: "term"; key: string; label?: string };

/** Choisit la variante selon le mode (un texte simple vaut pour les deux). */
export function pickText(texts: Record<string, TextValue>, key: string, mode: Mode, fallback = ""): string {
  const v = texts[key];
  if (v === undefined) return fallback;
  return typeof v === "string" ? v : v[mode];
}

const MARK = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

/** Découpe « un [[dns|DNS]] ici » en morceaux de texte et termes de glossaire. */
export function parseRich(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    if (m.index! > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    parts.push({ type: "term", key: m[1], label: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}
