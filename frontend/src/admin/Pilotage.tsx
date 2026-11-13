import { useEffect, useState } from "react";
import { api } from "../lib/api";
import SchemaForm from "../components/SchemaForm";
import type { ScreenSettings } from "../lib/types";
import type { TabProps } from "./shared";

export default function Pilotage({ state, meta, run }: TabProps) {
  const phases = state.phases;
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenSettings>(state.screen);
  useEffect(() => setScreen(state.screen), [state.screen]);

  const savePhases = (order: string[], enabled: Record<string, boolean>) =>
    run(() => api("/api/admin/phases", "PUT", { order, enabled }));
  const move = (i: number, d: number) => {
    const ids = phases.map((p) => p.id);
    const j = i + d;
    if (j < 1 || j >= ids.length) return; // l'accueil reste en premier
    [ids[i], ids[j]] = [ids[j], ids[i]];
    savePhases(ids, {});
  };
  const enabledPhases = phases.filter((p) => p.enabled);
  const sSet = <K extends keyof ScreenSettings>(k: K, v: ScreenSettings[K]) => setScreen({ ...screen, [k]: v });

  return (
    <>
      <section className="card">
        <h2>Progression des visiteurs</h2>
        <div className="seg">
          {(["free", "guided"] as const).map((m) => (
            <button key={m} className={state.mode === m ? "on" : ""} onClick={() => run(() => api("/api/admin/progression", "PUT", { mode: m }))}>
              {m === "free" ? "Libre" : "Guidé"}
            </button>
          ))}
        </div>
        <p className="dim">{state.mode === "free" ? "Chacun avance à son rythme." : "Les visiteurs attendent : tu ouvres les étapes pour tout le monde."}</p>
        {state.mode === "guided" && (
          <>
            <ol className="steps">
              {enabledPhases.map((p) => (
                <li key={p.id} className={p.id === "p0" || state.guided_open.includes(p.id) ? "open" : ""}>
                  {p.title} <span className="pill">{p.id === "p0" || state.guided_open.includes(p.id) ? "ouverte" : "fermée"}</span>
                </li>
              ))}
            </ol>
            <div className="row">
              <button className="btn" onClick={() => run(() => api("/api/admin/guided/open-next", "POST"))}>Ouvrir l'étape suivante ▶</button>
              <button className="btn ghost" onClick={() => run(() => api("/api/admin/guided/close-last", "POST"))}>Refermer la dernière</button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>Phases</h2>
        <ul className="phaselist">
          {phases.map((p, i) => (
            <li key={p.id}>
              <div className="row between">
                <span className="row">
                  <button className="icon" disabled={i < 2} onClick={() => move(i, -1)} aria-label="Monter">▲</button>
                  <button className="icon" disabled={i === 0 || i === phases.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">▼</button>
                  <b>{p.title}</b>{p.optional && <span className="pill">optionnelle</span>}
                </span>
                <span className="row">
                  {meta.phase_schemas[p.id]?.length > 0 && (
                    <button className="btn small ghost" onClick={() => { setOpen(open === p.id ? null : p.id); setDrafts({ ...drafts, [p.id]: p.params }); }}>Réglages</button>
                  )}
                  <label className="switch inline">
                    <input type="checkbox" checked={p.enabled} disabled={p.id === "p0"}
                      onChange={(e) => savePhases(phases.map((x) => x.id), { [p.id]: e.target.checked })} />
                    <span>{p.enabled ? "Active" : "Off"}</span>
                  </label>
                </span>
              </div>
              {open === p.id && (
                <div className="sub">
                  <SchemaForm schema={meta.phase_schemas[p.id]} values={drafts[p.id] ?? p.params}
                    onChange={(v) => setDrafts({ ...drafts, [p.id]: v })} />
                  <button className="btn small" onClick={() => run(() => api(`/api/admin/phases/${p.id}/params`, "PUT", { values: drafts[p.id] }), "Réglages enregistrés")}>Enregistrer</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Grand écran</h2>
        <div className="seg">
          {([["auto", "Rotation auto"], ["phase", "Phase fixe"], ["attract", "Veille (QR)"]] as const).map(([m, l]) => (
            <button key={m} className={screen.mode === m ? "on" : ""} onClick={() => sSet("mode", m)}>{l}</button>
          ))}
        </div>
        <div className="form two">
          <label className="field"><span>Phase affichée (mode fixe)</span>
            <select value={screen.phase_id} onChange={(e) => sSet("phase_id", e.target.value)}>
              {phases.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          <label className="field"><span>Rotation toutes les (s)</span>
            <input type="number" min={5} max={120} value={screen.rotation_s} onChange={(e) => sSet("rotation_s", Number(e.target.value))} /></label>
          <label className="field"><span>Veille après inactivité (s, 0 = jamais)</span>
            <input type="number" min={0} max={3600} value={screen.attract_after_s} onChange={(e) => sSet("attract_after_s", Number(e.target.value))} /></label>
          <label className="field switch"><input type="checkbox" checked={screen.show_wifi_qr} onChange={(e) => sSet("show_wifi_qr", e.target.checked)} />
            <span>Afficher le QR Wi-Fi sur l'écran de veille</span></label>
          <label className="field switch"><input type="checkbox" checked={screen.qr_use_host} onChange={(e) => sSet("qr_use_host", e.target.checked)} />
            <span>QR avec le nom DNS plutôt que l'IP</span><small>Par défaut l'IP : fonctionne même si le DNS privé du téléphone contourne Pi-hole.</small></label>
        </div>
        <button className="btn" onClick={() => run(() => api("/api/admin/screen", "PUT", screen), "Écran mis à jour")}>Appliquer</button>
      </section>
    </>
  );
}
