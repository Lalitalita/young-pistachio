const AZERTY_ROWS = ["azertyuiop", "qsdfghjklm", "wxcvbn"];
const QWERTY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
/** Marches diagonales connues (changement de rangée), trop répandues pour être oubliées. */
const KNOWN_WALKS = [
  "azerty", "qwerty", "aqwzsx", "zaqwsx", "qazwsx", "wsxedc", "edcrfv", "rfvtgb",
  "poiuyt", "mlkjhg", "1234567890", "0987654321", "azertyuiop", "qsdfghjklm",
];

function hasRowRun(lower: string, rows: string[], minLen = 4): boolean {
  for (const row of rows) {
    const rev = [...row].reverse().join("");
    for (let i = 0; i + minLen <= lower.length; i++) {
      const chunk = lower.slice(i, i + minLen);
      if (row.includes(chunk) || rev.includes(chunk)) return true;
    }
  }
  return false;
}

/** Suite de touches clavier (AZERTY ou QWERTY), horizontale ou en diagonale connue. */
export function hasKeyboardSequence(password: string): boolean {
  const lower = password.toLowerCase();
  if (KNOWN_WALKS.some((w) => lower.includes(w))) return true;
  return hasRowRun(lower, AZERTY_ROWS) || hasRowRun(lower, QWERTY_ROWS);
}
