import { useEffect, useState } from "react";
import { PATTERN_LABELS } from "./explain";
import type { PatternCode } from "./types";
import type { PublicState } from "../../lib/types";
import type { ScreenProps } from "../types";

const MAX_YEARS = 50_000_000_000; // échelle du thermomètre (log), bien au-delà de l'âge de l'univers
const SCALE = Math.log10(MAX_YEARS * 365.25 * 86400);

/** Position (0–100 %) d'un temps de cassage sur le thermomètre (échelle logarithmique). */
export function gaugePercent(seconds: number): number {
  if (seconds <= 1) return 0;
  return Math.max(0, Math.min(100, (Math.log10(seconds) / SCALE) * 100));
}

export default function Screen({ info, state }: ScreenProps) {
  const targetYears = Number(info.params.target_years ?? 10);
  const p1 = state.p1;
  const targetPct = gaugePercent(targetYears * 365.25 * 86400);
  const [lastKey, setLastKey] = useState("");
  const latest = p1.feed[0];
  useEffect(() => { if (latest) setLastKey(latest.pseudo + latest.score + Math.random()); }, [latest?.pseudo, latest?.score]);

  return (
    <div className="p1-screen">
      <h1>{info.title}</h1>
      <p className="lead">Objectif : tenir au moins {targetYears.toLocaleString("fr-FR")} ans</p>

      <div className="thermo">
        <div className="thermo-target" style={{ left: `${targetPct}%` }}><span>🎯 Objectif</span></div>
        {latest && (
          <div className="thermo-marker" key={lastKey} style={{ left: `${gaugePercent(latest.offline_fast)}%` }} />
        )}
        <div className="thermo-fill" />
      </div>
      <div className="thermo-labels"><span>0 s</span><span>1 an</span><span>1 000 ans</span><span>âge de l'univers</span></div>

      <div className="p1-cols">
        <div className="p1-col">
          <h3>{p1.strongest ? "🏆 Record du jour : le plus solide" : "En attente du premier essai…"}</h3>
          {p1.strongest && <p className="record">{p1.strongest.pseudo} <b>{Math.round(p1.strongest.score)}/100</b></p>}
          {p1.best_progress && (
            <>
              <h3>📈 Meilleure progression</h3>
              <p className="record">{p1.best_progress.pseudo} <b>+{p1.best_progress.delta} pts</b></p>
            </>
          )}
        </div>
        <div className="p1-col">
          <h3>Top des pièges du jour</h3>
          {p1.top_pitfalls.length === 0 ? <p className="dim">Pas encore de données.</p> : (
            <ul className="toppitfalls">
              {p1.top_pitfalls.map((pf: { code: string; pct: number }) => (
                <li key={pf.code}><span>{PATTERN_LABELS[pf.code as PatternCode] ?? pf.code}</span><b>{pf.pct}%</b></li>
              ))}
            </ul>
          )}
        </div>
        <div className="p1-col">
          <h3>En direct</h3>
          <ul className="p1feed">
            {p1.feed.slice(0, 6).map((f: PublicState["p1"]["feed"][number], i: number) => (
              <li key={f.pseudo + i}><span>{f.pseudo}</span><b>{Math.round(f.score)}/100</b></li>
            ))}
            {!p1.feed.length && <li className="dim">Personne pour l'instant</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
