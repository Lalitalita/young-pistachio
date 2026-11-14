import { useState } from "react";
import { api } from "../lib/api";
import { STATUS_LABEL } from "../phases/p3/shared";
import type { TabProps } from "./shared";

const TARGETS = [["", "Au hasard"], ["demo-web", "Site web"], ["demo-api", "API"], ["demo-db", "Base de données"]] as const;

export default function Phase3({ state, run }: TabProps) {
  const [target, setTarget] = useState("");
  const [agent, setAgent] = useState<string>("");
  const p3 = state.p3, boss = p3.boss;
  const busy = boss.status !== "idle";
  const checkAgent = () => run(async () => {
    const r = await api<{ ok: boolean; status?: Record<string, string>; error?: string }>("/api/admin/phase3/agent");
    setAgent(r.ok ? Object.entries(r.status!).map(([k, v]) => `${k} : ${v}`).join(" · ") : `❌ ${r.error}`);
  });
  return (
    <>
      <section className="card">
        <h2>Supervision en direct</h2>
        <ul className="services">
          {p3.services.map((s) => (
            <li key={s.id}><span className={"dot " + (s.status === "up" ? "on" : s.status === "unknown" ? "off" : "")} />
              {s.icon} {s.label} <b>{STATUS_LABEL[s.status]}</b>{s.ms !== null && s.status !== "down" && <span className="dim"> · {s.ms} ms</span>}</li>
          ))}
        </ul>
        {!p3.pi_configured && <p className="dim">Raspberry Pi non surveillé : renseigne PI_IP dans .env.</p>}
        <div className="row wrap">
          <button className="btn small ghost" onClick={checkAgent}>Vérifier le chaos-agent</button>
          {agent && <span className="dim">{agent}</span>}
        </div>
      </section>
      <section className={"card" + (busy ? " danger" : "")}>
        <h2>Moment « boss » (panne réelle)</h2>
        <p className="dim">
          {busy ? `Panne en cours (${boss.status === "voting" ? "vote" : "réparation"}) sur ${boss.target}${boss.by ? ` · déclenchée par ${boss.by}` : ""}.`
            : boss.cooldown_s > 0 ? `Prochaine panne automatique possible dans ${boss.cooldown_s} s.` : "Prêt."}
          {" "}File d'attente : {boss.queue_len}{boss.queue.length ? ` (${boss.queue.join(", ")})` : ""}.
        </p>
        {boss.error && <p className="err">⚠️ {boss.error}</p>}
        <div className="row wrap">
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
            {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn warn" disabled={busy}
            onClick={() => run(() => api("/api/admin/phase3/boss", "POST", target ? { target } : {}), "Panne déclenchée")}>🚨 Déclencher maintenant</button>
          <button className="btn ghost" disabled={boss.queue_len === 0} onClick={() => run(() => api("/api/admin/phase3/queue", "DELETE"), "File vidée")}>Vider la file</button>
          <button className="btn" onClick={() => run(async () => {
            const r = await api<{ errors: string[] }>("/api/admin/phase3/restore", "POST");
            if (r.errors.length) throw new Error(r.errors.join(" ; "));
          }, "Tous les services relancés")}>🛟 Tout rétablir</button>
        </div>
        <p className="dim">Le délai, la durée du vote et le mode « panne simulée » se règlent dans Pilotage → Phases → Panne en prod.</p>
      </section>
    </>
  );
}
