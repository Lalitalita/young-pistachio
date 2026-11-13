import { useState } from "react";
import { api } from "../lib/api";
import type { TabProps } from "./shared";

export default function Tools({ state, run }: TabProps) {
  const [count, setCount] = useState(state.demo.count);
  const [confirm, setConfirm] = useState("");
  return (
    <>
      <section className="card">
        <h2>Mode démo / test</h2>
        <p className="dim">Des bots simulent des visiteurs (jamais enregistrés en base). Utile pour tester l'écran sans public.</p>
        <div className="row">
          <label className="field inline"><span>Nombre de bots</span>
            <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
          <button className={"btn" + (state.demo.enabled ? " warn" : "")} onClick={() => run(() => api("/api/admin/demo", "POST", { enabled: !state.demo.enabled, count }))}>
            {state.demo.enabled ? "Arrêter la démo" : "Lancer la démo"}
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Export</h2>
        <a className="btn ghost" href="/api/admin/export.csv" download>⬇ Statistiques anonymes (CSV)</a>
      </section>
      <section className="card danger">
        <h2>Reset de fin de journée</h2>
        <p className="dim">Efface visiteurs, scores et compteurs. Les réglages et contenus sont conservés. Irréversible.</p>
        <div className="row">
          <input placeholder="Tape RESET pour confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="btn warn" disabled={confirm !== "RESET"}
            onClick={() => run(() => api("/api/admin/reset", "POST", { confirm }), "Reset effectué").then(() => setConfirm(""))}>Tout effacer</button>
        </div>
      </section>
    </>
  );
}
