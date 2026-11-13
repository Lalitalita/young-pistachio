import type { Branding } from "./types";

export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Applique la charte (modifiable dans l'admin) via des variables CSS. */
export function applyTheme(b: Branding): void {
  const s = document.documentElement.style;
  s.setProperty("--brand", b.color_brand);
  s.setProperty("--brand-2", b.color_accent);
  s.setProperty("--bg", b.color_bg);
  s.setProperty("--bg-2", mixHex(b.color_bg, "#ffffff", 0.06));
  s.setProperty("--card", mixHex(b.color_bg, "#ffffff", 0.1));
  s.setProperty("--glow", mixHex(b.color_bg, b.color_accent, 0.55));
}
