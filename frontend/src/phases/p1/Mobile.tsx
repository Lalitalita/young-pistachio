import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { T, useContent } from "../../lib/content";
import { auditPassword } from "./audit";
import { ensureZxcvbn } from "./dictionaries";
import { explainPattern, PATTERN_LABELS } from "./explain";
import { formatDuration } from "./format";
import type { AuditResult, Character } from "./types";
import type { MobileProps } from "../types";

const FICHE_ROWS: [string, (c: Character) => string][] = [
  ["Prénom", (c) => c.prenom], ["Nom", (c) => c.nom],
  ["Date de naissance", (c) => { const [y, m, d] = c.naissance.split("-"); return `${d}/${m}/${y}`; }],
  ["Ville", (c) => c.ville], ["Animal", (c) => c.animal], ["Club de cœur", (c) => c.club],
  ["Copain/copine", (c) => c.copain],
];

function Gauge({ score }: { score: number }) {
  const color = score < 30 ? "var(--bad)" : score < 70 ? "var(--warn)" : "var(--ok)";
  return (
    <div className="gauge" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
      <div className="gauge-bar" style={{ width: `${score}%`, background: color }} />
    </div>
  );
}

export default function Mobile({ info, me, send }: MobileProps) {
  const { t, mode } = useContent();
  const targetYears = Number(info.params.target_years ?? 10);
  const [character, setCharacter] = useState<Character | null>(null);
  const [password, setPassword] = useState("");
  const [live, setLive] = useState<AuditResult | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gen = useRef(0);

  useEffect(() => { ensureZxcvbn(); api<Character>("/api/character").then(setCharacter); }, []);

  useEffect(() => {
    if (!character || result) return;
    const my = ++gen.current;
    if (!password) { setLive(null); return; }
    const timer = setTimeout(() => {
      auditPassword(password, character, targetYears).then((r) => { if (gen.current === my) setLive(r); });
    }, 150);
    return () => clearTimeout(timer);
  }, [password, character, targetYears, result]);

  const submit = async () => {
    if (!character || busy || !password) return;
    setBusy(true); setError("");
    try {
      const r = await auditPassword(password, character, targetYears);
      await api("/api/phase1/submit", "POST", { password, length: r.length, score: r.score, patterns: r.patterns, times: r.times });
      setResult(r);
    } catch { setError("Oups, la connexion a été perdue. Réessaie."); }
    setBusy(false);
  };
  const retry = () => { setResult(null); setLive(null); setPassword(""); };
  const reached = result ? result.times.offline_fast >= targetYears * 365.25 * 86400 : false;

  if (!character) return <div className="card phase">{t("ui.loading", "Chargement…")}</div>;

  return (
    <div className="p1">
      <section className="card phase">
        <h2><T k="p1.title" /></h2>
        <p><T k="p1.intro" /></p>
        <p className="target"><T k="p1.target" vars={{ years: targetYears }} /></p>
      </section>

      <section className="card phase warning">
        <h3>{t("p1.warning_title")}</h3>
        <p><T k="p1.warning_text" /></p>
      </section>

      <section className="card phase">
        <h3>{t("p1.character_title")}</h3>
        <dl className="fiche">
          {FICHE_ROWS.map(([label, get]) => <div key={label}><dt>{label}</dt><dd>{get(character)}</dd></div>)}
        </dl>
      </section>

      <section className="card phase">
        <label className="field">
          <span>{t("p1.password_label")}</span>
          <input type="text" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            placeholder={t("p1.password_placeholder")} value={password} disabled={!!result}
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        {!result && (
          <>
            <Gauge score={live?.score ?? 0} />
            {mode === "expert" && live && (
              <p className="dim small">{live.length} caractères · {live.patterns.length} piège(s) détecté(s) en direct</p>
            )}
            {error && <p className="err">{error}</p>}
            <button className="btn big" disabled={!password || busy} onClick={submit}>{t("p1.submit")}</button>
          </>
        )}

        {result && (
          <div className="p1-result">
            <p className={reached ? "verdict ok" : "verdict bad"}>
              <T k={reached ? "p1.success" : "p1.fail"} />
            </p>
            <ul className="times">
              {(["online", "offline_fast", "gpu_farm"] as const).map((k) => (
                <li key={k}><span>{t(`p1.time_${k === "offline_fast" ? "offline" : k}`)}</span><b>{formatDuration(result.times[k])}</b></li>
              ))}
            </ul>
            <h3>{t("p1.pitfalls_title")}</h3>
            {result.patterns.length === 0 ? (
              <p className="dim"><T k="p1.no_pitfalls" /></p>
            ) : (
              <ul className="pitfalls">
                {result.patterns.map((p) => (
                  <li key={p}><b>{PATTERN_LABELS[p]}</b><span>{explainPattern(p, character, mode)}</span></li>
                ))}
              </ul>
            )}
            <h3>{t("p1.lesson_title")}</h3>
            <ul className="lessons">
              {["p1.lesson_1", "p1.lesson_2", "p1.lesson_3"].map((k) => <li key={k}><T k={k} /></li>)}
            </ul>
            <div className="row">
              <button className="btn ghost" onClick={retry}>{t("p1.retry")}</button>
              <button className="btn big" disabled={me.next_locked} onClick={() => send({ type: "advance" })}>
                {me.next_locked ? t("ui.waiting_host", "En attente de l'animateur…") : t("p1.continue")}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
