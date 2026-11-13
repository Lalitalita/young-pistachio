import type { ScreenProps } from "../types";

/** Accueil sur le grand écran : seulement des pseudos aléatoires et des compteurs agrégés. */
export default function Screen({ state }: ScreenProps) {
  const recent = state.recent.slice().reverse();
  const optIn = state.counts.opt_in;
  return (
    <div className="p0-screen">
      <div className="p0-left">
        <h1>Bienvenue au <em>Cyber Parcours</em></h1>
        <p className="lead">Scanne le QR code pour rejoindre le parcours.</p>
        <h3>Ils viennent de nous rejoindre</h3>
        <ul className="chips">
          {recent.map((r, i) => <li key={r.pseudo + i}>{r.pseudo}</li>)}
          {!recent.length && <li className="ghost">Tu seras le premier ?</li>}
        </ul>
        {optIn > 0 && <p className="dim optin-count">🔍 {optIn} {optIn > 1 ? "ont accepté" : "a accepté"} de voir {optIn > 1 ? "leurs" : "ses"} propres requêtes</p>}
      </div>
      <figure className="p0-qr">
        <img src="/api/qr/url.svg" alt="QR code pour ouvrir le parcours" />
        <figcaption>{state.qr.url.replace("http://", "")}</figcaption>
      </figure>
    </div>
  );
}
