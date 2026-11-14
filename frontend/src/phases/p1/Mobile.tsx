import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { T, useContent } from "../../lib/content";
import { interpolate, plain } from "../../lib/richtext";
import { auditPassword } from "./audit";
import { ensureZxcvbn } from "./dictionaries";
import { explainPattern, PATTERN_LABELS } from "./explain";
import { formatDuration } from "./format";
import { WORDLIST_SIZE } from "./passphrase";
import type { AuditResult, Character } from "./types";
import type { MobileProps } from "../types";

const FICHE_ROWS: [string, (c: Character) => string][] = [
  ["Prénom", (c) => c.prenom], ["Nom", (c) => c.nom],
  ["Naissance", (c) => { const [y, m, d] = c.naissance.split("-"); return `${d}/${m}/${y}`; }],
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
  const input = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

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

  const scrollTop = () => window.setTimeout(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!character || busy || !password) return;
    setBusy(true); setError("");
    try {
      const r = await auditPassword(password, character, targetYears);
      await api("/api/phase1/submit", "POST", { password, length: r.length, score: r.score, patterns: r.patterns, times: r.times });
      input.current?.blur(); // referme le clavier pour voir le résultat
      setResult(r);
      scrollTop();
    } catch { setError("Oups, la connexion a été perdue. Réessaie."); }
    setBusy(false);
  };
  const retry = () => { setResult(null); setLive(null); setPassword(""); scrollTop(); window.setTimeout(() => input.current?.focus(), 400); };
  const reached = result ? result.times.offline_fast >= targetYears * 365.25 * 86400 : false;

  if (!character) return <div className="card phase">{t("ui.loading", "Chargement…")}</div>;
  const v = { prenom: character.prenom };
  const shown = result ?? live;
  const hintKey = shown?.hint ? `p1.hint_${shown.hint}` : "";

  return (
    <div className="p1" ref={top}>
      {!result && (
        <>
          <section className="card phase">
            <h2><T k="p1.title" /></h2>
            <p><T k="p1.intro" vars={v} /></p>
            <p className="target"><T k="p1.target" vars={{ years: targetYears }} /></p>
            <ol className="steps">
              {[1, 2, 3].map((n) => <li key={n}><T k={`p1.step_${n}`} vars={v} /></li>)}
            </ol>
          </section>

          <section className="card phase">
            <h3><T k="p1.character_title" vars={v} /></h3>
            <p className="dim small"><T k="p1.character_help" /></p>
            <dl className="fiche">
              {FICHE_ROWS.map(([label, get]) => <div key={label}><dt>{label}</dt><dd>{get(character)}</dd></div>)}
            </dl>
          </section>

          <form className="card phase" onSubmit={submit}>
            <p className="warn-note"><b>{t("p1.warning_title")}</b> <T k="p1.warning_text" /></p>
            <label className="field">
              <span><T k="p1.password_label" vars={v} /></span>
              <input ref={input} type="text" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                enterKeyHint="go" placeholder={t("p1.password_placeholder")} value={password}
                onFocus={(e) => window.setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 350)}
                onChange={(e) => setPassword(e.target.value)} />
            </label>
            <Gauge score={live?.score ?? 0} />
            {live && live.words >= 3 && <p className="dim small"><T k="p1.words_detected" vars={{ n: live.words, bits: Math.round(live.words * Math.log2(WORDLIST_SIZE)) }} /></p>}
            {mode === "expert" && live && <p className="dim small">{live.length} caractères · {live.patterns.length} piège(s) détecté(s) en direct</p>}
            {hintKey && <p className="hint">{interpolate(t(hintKey), v)}</p>}
            {error && <p className="err">{error}</p>}
            <div className="stickybar">
              <button className="btn big" type="submit" disabled={!password || busy}>{t("p1.submit")}</button>
            </div>
          </form>
        </>
      )}

      {result && (
        <section className="card phase">
          <div className="p1-result">
            <p className={reached ? "verdict ok" : "verdict bad"}><T k={reached ? "p1.success" : "p1.fail"} /></p>
            {hintKey && <p className="hint">{interpolate(t(hintKey), v)}</p>}
            <h3><T k="p1.times_title" /></h3>
            <ul className="times">
              {(["online", "offline_fast", "gpu_farm"] as const).map((k) => {
                const key = k === "offline_fast" ? "offline" : k;
                return (
                  <li key={k}>
                    <div><b>{t(`p1.time_${key}`)}</b><small>{plain(t(`p1.time_${key === "offline" ? "offline" : key === "gpu_farm" ? "gpu" : "online"}_desc`))}</small></div>
                    <strong>{formatDuration(result.times[k])}</strong>
                  </li>
                );
              })}
            </ul>
            <p className="dim small"><T k="p1.times_note" /></p>
            <h3><T k="p1.pitfalls_title" /></h3>
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
          </div>
          <div className="stickybar">
            <button className="btn ghost" onClick={retry}>{t("p1.retry")}</button>
            <button className="btn" disabled={me.next_locked} onClick={() => send({ type: "advance" })}>
              {me.next_locked ? t("ui.waiting_host", "En attente…") : t("p1.continue")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
