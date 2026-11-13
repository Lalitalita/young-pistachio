import { Suspense, useState } from "react";
import { api } from "../lib/api";
import { useEvent } from "../lib/useEvent";
import Status from "../components/Status";
import { PHASES } from "../phases/registry";

export default function Visitor() {
  const { state, me, connected, send } = useEvent("visitor");
  const [rolling, setRolling] = useState(false);

  if (!state || !me) {
    return <main className="page"><p className="dim">Connexion au parcours…</p><Status connected={connected} /></main>;
  }

  const reroll = async () => {
    setRolling(true);
    try { await api("/api/session/reroll", "POST"); } finally { setTimeout(() => setRolling(false), 350); }
  };

  const enabled = state.phases.filter((p) => p.enabled);
  const atEnd = me.phase === "end";
  const accessible = atEnd || me.allowed.includes(me.phase);
  const info = atEnd ? null : state.phases.find((p) => p.id === me.phase);
  const plugin = PHASES[me.phase];
  const pct = Math.round((Math.min(me.index, me.total) / Math.max(1, me.total)) * 100);

  return (
    <main className="page">
      <header className="topbar">
        <img className="logo" src={state.branding.logo_url} alt={state.branding.school_name} />
        <button className={"pseudo" + (rolling ? " spin" : "")} onClick={reroll} title="Changer de pseudo" aria-label="Changer de pseudo">
          <span>{me.pseudo}</span><i aria-hidden>🎲</i>
        </button>
      </header>

      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar" style={{ width: `${Math.max(pct, 4)}%` }} />
        <ol>{enabled.map((p, i) => (
          <li key={p.id} className={i < me.index ? "done" : i === me.index && !atEnd ? "now" : ""} />
        ))}<li className={atEnd ? "now" : ""} /></ol>
      </div>

      <div className="stage" key={me.phase + String(accessible)}>
        {!accessible ? (
          <section className="card phase lock">
            <h2>Une petite pause ⏳</h2>
            <p>L'animateur ouvre les étapes au fur et à mesure. Reste connecté : ça repart dans un instant !</p>
          </section>
        ) : (
          <Suspense fallback={<div className="card phase">Chargement…</div>}>
            {plugin && <plugin.Mobile info={info ?? { id: "end", title: "Bravo !", tagline: `Direction : ${state.branding.next_workshop}`, enabled: true, optional: false, params: {} }}
              state={state} me={me} send={send} />}
          </Suspense>
        )}
      </div>

      <Status connected={connected} />
    </main>
  );
}
