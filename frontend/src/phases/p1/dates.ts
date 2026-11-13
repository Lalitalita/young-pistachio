/** Toutes les formes usuelles d'une date de naissance (AAAA-MM-JJ) utilisées dans un mot de passe. */
export function dateVariants(iso: string): string[] {
  const [yyyy, mm, dd] = iso.split("-");
  const yy = yyyy.slice(2);
  const out = [
    `${dd}${mm}${yyyy}`, `${mm}${dd}${yyyy}`, `${yyyy}${mm}${dd}`, `${dd}${mm}${yy}`,
    `${dd}${mm}`, `${mm}${dd}`, yyyy, yy,
    `${dd}/${mm}`, `${dd}/${mm}/${yyyy}`, `${dd}-${mm}-${yyyy}`, `${dd}.${mm}.${yyyy}`,
  ];
  return [...new Set(out)];
}

/** Années plausibles (1950 → année en cours), en texte, pour détecter une année « générique ». */
export function allYears(now: Date = new Date()): string[] {
  const end = now.getFullYear();
  const out: string[] = [];
  for (let y = 1950; y <= end; y++) out.push(String(y));
  return out;
}
