import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { T, useContent } from "../../lib/content";
import { preloadPhases } from "../registry";
import type { MobileProps } from "../types";

export default function Mobile({ me, send }: MobileProps) {
  const { t } = useContent();
  const [optIn, setOptIn] = useState(me.consent);
  const [rolling, setRolling] = useState(false);
  useEffect(() => setOptIn(me.consent), [me.consent]);
  useEffect(() => preloadPhases(["p1", "p2", "p3"]), []); // tâche de fond pendant l'intro

  const toggle = () => { setOptIn(!optIn); send({ type: "consent", consent: !optIn }); };
  const reroll = async () => {
    setRolling(true);
    try { await api("/api/session/reroll", "POST"); } finally { setTimeout(() => setRolling(false), 350); }
  };

  return (
    <div className="p0">
      <section className="card phase">
        <h2><T k="p0.title" /></h2>
        <p><T k="p0.intro" /></p>
        <div className="codename">
          <small>{t("p0.pseudo_label")}</small>
          <button className={"codename-btn" + (rolling ? " spin" : "")} onClick={reroll} aria-label={t("ui.reroll", "Changer de pseudo")}>
            <b>{me.pseudo}</b><i aria-hidden>🎲</i>
          </button>
          <small className="dim"><T k="p0.pseudo_help" /></small>
        </div>
      </section>

      <section className="card phase privacy">
        <h3>🔒 {t("p0.privacy_title")}</h3>
        <ul>
          {["p0.privacy_1", "p0.privacy_2", "p0.privacy_3"].map((k) => <li key={k}><i aria-hidden>✓</i><span><T k={k} /></span></li>)}
        </ul>
      </section>

      <section className="card phase">
        <label className="optin">
          <input type="checkbox" checked={optIn} onChange={toggle} />
          <span className="tick" aria-hidden />
          <span><b>{t("p0.optin_label")}</b></span>
        </label>
        <p className="dim small"><T k={optIn ? "p0.optin_help" : "p0.optin_off"} /></p>
      </section>

      <button className="btn big" disabled={me.next_locked} onClick={() => send({ type: "advance" })}>
        {me.next_locked ? t("ui.waiting_host", "En attente de l'animateur…") : t("p0.cta", "C'est parti !")}
      </button>
    </div>
  );
}
