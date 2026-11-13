import { Suspense, useState } from "react";
import { api } from "../lib/api";
import { useEvent } from "../lib/useEvent";
import Status from "../components/Status";
import { ContentProvider, ModeToggle, useContent } from "../lib/content";
import { PHASES } from "../phases/registry";

function Shell({ state, me, connected, send }: { state: NonNullable<ReturnType<typeof useEvent>["state"]>; me: NonNullable<ReturnType<typeof useEvent>["me"]>; connected: boolean; send: ReturnType<typeof useEvent>["send"] }) {
  const { t } = useContent();
  const [rolling, setRolling] = useState(false);

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
        <button className={"pseudo" + (rolling ? " spin" : "")} onClick={reroll} title={t("ui.reroll", "Changer de pseudo")} aria-label={t("ui.reroll", "Changer de pseudo")}>
          <span>{me.pseudo}</span><i aria-hidden>🎲</i>
        </button>
      </header>

      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar" style={{ width: `${Math.max(pct, 4)}%` }} />
        <ol>{enabled.map((p, i) => (
          <li key={p.id} className={i < me.index ? "done" : i === me.index && !atEnd ? "now" : ""} />
        ))}<li className={atEnd ? "now" : ""} /></ol>
      </div>

      {accessible && <ModeToggle />}

      <div className="stage" key={me.phase + String(accessible)}>
        {!accessible ? (
          <section className="card phase lock">
            <h2>{t("ui.locked_title")}</h2>
            <p>{t("ui.locked_text")}</p>
          </section>
        ) : (
          <Suspense fallback={<div className="card phase">{t("ui.loading", "Chargement…")}</div>}>
            {plugin && <plugin.Mobile info={info ?? { id: "end", title: "Bravo !", tagline: `Direction : ${state.branding.next_workshop}`, enabled: true, optional: false, params: {} }}
              state={state} me={me} send={send} />}
          </Suspense>
        )}
      </div>

      {accessible && (me.prev || me.phase !== "p0") && (
        <div className="backrow">
          {me.prev && me.allowed.includes(me.prev) && (
            <button className="linkbtn" onClick={() => send({ type: "goto", phase: me.prev })}>{t("ui.back", "← Étape précédente")}</button>
          )}
          {me.phase !== "p0" && (
            <button className="linkbtn" onClick={() => send({ type: "goto", phase: "p0" })}>{t("ui.restart", "↺ Recommencer")}</button>
          )}
        </div>
      )}

      <Status connected={connected} />
    </main>
  );
}

export default function Visitor() {
  const { state, me, connected, send } = useEvent("visitor");
  if (!state || !me) {
    return <main className="page"><p className="dim">Connexion au parcours…</p><Status connected={connected} /></main>;
  }
  return (
    <ContentProvider version={state.content_v}>
      <Shell state={state} me={me} connected={connected} send={send} />
    </ContentProvider>
  );
}
