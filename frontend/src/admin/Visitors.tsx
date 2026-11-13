import { useState } from "react";
import { api } from "../lib/api";
import type { TabProps } from "./shared";

export default function Visitors({ state, visitors, run }: TabProps) {
  const [bulk, setBulk] = useState("p0");
  const stepOptions = [...state.phases.map((p) => ({ id: p.id, label: p.title })), { id: "end", label: "Terminé (écran de fin)" }];
  const setPhase = (id: string, phase: string) => run(() => api(`/api/admin/visitors/${id}/phase`, "POST", { phase }));
  const rename = (id: string, cur: string) => {
    const p = window.prompt("Nouveau pseudo :", cur);
    if (p && p.trim()) run(() => api(`/api/admin/visitors/${id}/rename`, "POST", { pseudo: p.trim() }));
  };
  return (
    <>
      <section className="card">
        <h2>Visiteurs <span className="pill">{state.counts.connected} en ligne · {state.counts.day_total} aujourd'hui</span></h2>
        <div className="row wrap bulk">
          <b>Tout le monde →</b>
          <select value={bulk} onChange={(e) => setBulk(e.target.value)}>
            {stepOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <button className="btn small" onClick={() => window.confirm("Replacer TOUS les visiteurs sur cette étape ?") && run(() => api("/api/admin/visitors/phase-all", "POST", { phase: bulk }), "Visiteurs replacés")}>Appliquer</button>
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Pseudo</th><th>Étape</th><th>État</th><th /></tr></thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id} className={v.hidden ? "muted" : ""}>
                  <td>{v.pseudo}{v.bot && <span className="pill">bot</span>}{v.hidden && <span className="pill">masqué</span>}</td>
                  <td>
                    <select value={v.phase} onChange={(e) => setPhase(v.id, e.target.value)} aria-label="Étape">
                      {stepOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </td>
                  <td><span className={v.connected ? "dot on" : "dot"} /> {v.connected ? "en ligne" : "parti"}</td>
                  <td className="actions">
                    <button className="btn small ghost" onClick={() => rename(v.id, v.pseudo)}>Renommer</button>
                    <button className="btn small ghost" onClick={() => run(() => api(`/api/admin/visitors/${v.id}/hide`, "POST", { hidden: !v.hidden }))}>{v.hidden ? "Afficher" : "Masquer"}</button>
                  </td>
                </tr>
              ))}
              {!visitors.length && <tr><td colSpan={4} className="dim">Personne pour l'instant. Lance le mode démo dans « Outils » pour tester.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Classements</h2>
        <p className="dim">Vide le classement d'une phase (les scores arrivent avec les phases jouables).</p>
        <div className="row wrap">
          {state.phases.filter((p) => p.id !== "p0").map((p) => (
            <button key={p.id} className="btn small ghost" onClick={() => window.confirm(`Vider le classement « ${p.title} » ?`) && run(() => api(`/api/admin/leaderboard/${p.id}`, "DELETE"), "Classement vidé")}>{p.id.toUpperCase()}</button>
          ))}
        </div>
      </section>
    </>
  );
}
