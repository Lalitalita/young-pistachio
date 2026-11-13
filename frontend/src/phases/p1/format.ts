/** Durée en secondes → texte lisible, du « instantané » à « plus vieux que l'univers ». */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds > 13_800_000_000 * 365.25 * 86400) {
    return "plus vieux que l'univers (13,8 milliards d'années)";
  }
  if (seconds < 1) return "instantané";
  const units: [number, string][] = [
    [60, "s"], [3600, "min"], [86400, "h"], [365.25 * 86400, "jours"],
    [1000 * 365.25 * 86400, "ans"], [1e6 * 365.25 * 86400, "mille ans"],
    [1e9 * 365.25 * 86400, "millions d'années"], [Infinity, "milliards d'années"],
  ];
  const dividers = [1, 60, 3600, 86400, 365.25 * 86400, 1000 * 365.25 * 86400, 1e6 * 365.25 * 86400, 1e9 * 365.25 * 86400];
  for (let i = 0; i < units.length; i++) {
    if (seconds < units[i][0]) {
      const v = seconds / dividers[i];
      const n = v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
      return `${n.toLocaleString("fr-FR")} ${units[i][1]}`;
    }
  }
  return "une éternité";
}
