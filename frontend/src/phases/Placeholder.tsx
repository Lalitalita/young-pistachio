import type { MobileProps, ScreenProps } from "./types";

/** Gabarits provisoires : remplacés phase par phase aux étapes suivantes. */
export function MobilePlaceholder({ info, me, send, step }: MobileProps & { step: number }) {
  return (
    <section className="card phase">
      <h2>{info.title}</h2>
      <p>{info.tagline}</p>
      <p className="dim">Cette étape sera jouable à l'étape {step} du projet.</p>
      <button className="btn big" disabled={me.next_locked} onClick={() => send({ type: "advance" })}>
        {me.next_locked ? "En attente de l'animateur…" : "Continuer"}
      </button>
    </section>
  );
}

export function ScreenPlaceholder({ info, state, step }: ScreenProps & { step: number }) {
  const here = state.counts.by_phase[info.id] ?? 0;
  return (
    <div className="phase-screen">
      <h1>{info.title}</h1>
      <p className="lead">{info.tagline}</p>
      <div className="bignum"><b>{here}</b><span>visiteur{here > 1 ? "s" : ""} ici en ce moment</span></div>
      <p className="dim">Affichage jouable à l'étape {step}.</p>
    </div>
  );
}
