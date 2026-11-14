import type { P3Service } from "../../lib/types";
import type { ScreenProps } from "../types";
import { pick, STATUS_LABEL, useCountdown, votePercents } from "./shared";

const INCIDENT_NAMES: Record<string, string> = {
  web_down: "Site web", db_down: "Base de données", dns_broken: "DNS", disk_full: "Disque plein",
  cable: "Câble débranché", cpu: "CPU saturé", config: "Erreur de config",
};

function Tile({ s, hit }: { s: P3Service; hit: boolean }) {
  return (
    <div className={`tile ${s.status} ${s.kind}${hit ? " hit" : ""}`}>
      <span className="led" aria-hidden />
      <span className="icon" aria-hidden>{s.status === "down" && s.kind === "physical" ? "🔌" : s.icon}</span>
      <b>{s.label}</b>
      <span className="st">{s.kind === "physical" && s.status === "unknown" ? "Non configuré" : STATUS_LABEL[s.status]}</span>
      <span className="ms">{s.ms !== null && s.status !== "down" ? `${s.ms} ms` : "—"}</span>
      {s.kind === "physical" && <span className="tag">physique</span>}
    </div>
  );
}

export default function Screen({ info, state }: ScreenProps) {
  const mode = "curious" as const; // le grand écran parle à tout le monde : version simple
  const p3 = state.p3, boss = p3.boss, bc = p3.boss_content;
  const left = useCountdown(boss.vote_ends_at, state.server_time);
  const pi = p3.services.find((s) => s.id === "pi");
  const incident = p3.services.some((s) => s.status === "down" || s.status === "degraded");
  const pct = votePercents(boss.votes);

  if (boss.status !== "idle") {
    return (
      <div className="p3-screen boss-on">
        <h1>🚨 {boss.status === "voting" ? "PANNE MAJEURE" : "RÉPARATION EN COURS"}</h1>
        {boss.by && <p className="lead">déclenchée par <b>{boss.by}</b>{boss.real ? "" : " (simulation)"}</p>}
        <div className="tiles">
          {p3.services.map((s) => <Tile key={s.id} s={s} hit={s.id === boss.target} />)}
        </div>
        {boss.status === "voting" ? (
          <div className="vote">
            <h2>{pick(bc.question, mode)} <span className="timer">{left}s</span></h2>
            <ul>
              {bc.choices.map((c, i) => (
                <li key={i}><span className="label">{pick(c, mode)}</span>
                  <div className="bar"><i style={{ width: `${pct[i]}%` }} /></div><b>{pct[i]}%</b></li>
              ))}
            </ul>
            <p className="dim">{boss.total_votes} vote{boss.total_votes > 1 ? "s" : ""} · vote sur ton téléphone !</p>
          </div>
        ) : (
          <div className="vote result">
            <h2>✅ {boss.result ? `${boss.result.pct} % ont trouvé la bonne cause` : "Redémarrage…"}</h2>
            <p className="explain">{pick(bc.explanation, mode)}</p>
            <p className="dim">Redémarrage automatique du service…</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p3-screen">
      {pi && p3.pi_configured && pi.status === "down" && (
        <div className="pi-alert" role="alert">🔌 Le serveur physique ne répond plus : quelqu'un a débranché le câble ?!</div>
      )}
      <h1>Salle de contrôle <span className={"badge " + (incident ? "bad" : "ok")}>{incident ? "Incident en cours" : "Tous les systèmes fonctionnent"}</span></h1>
      <p className="lead">{info.tagline}</p>
      <div className="tiles">{p3.services.map((s) => <Tile key={s.id} s={s} hit={false} />)}</div>

      <div className="p3-cols">
        <div className="p3-col">
          <h3>🏆 Meilleurs dépanneurs</h3>
          {p3.stats.top.length === 0 ? <p className="dim">En attente du premier diagnostic…</p> : (
            <ol className="rank">{p3.stats.top.map((r) => <li key={r.pseudo}><span>{r.pseudo}</span><b>{r.score}</b></li>)}</ol>
          )}
          <p className="dim small">
            {p3.stats.solved} incident{p3.stats.solved > 1 ? "s" : ""} résolu{p3.stats.solved > 1 ? "s" : ""}
            {p3.stats.avg_elapsed !== null && ` · ${p3.stats.avg_elapsed} s en moyenne`}
            {p3.stats.fastest && ` · record ${p3.stats.fastest.elapsed} s (${p3.stats.fastest.pseudo})`}
          </p>
        </div>
        <div className="p3-col">
          <h3>📟 Journal de supervision</h3>
          <ul className="events">
            {p3.events.slice(0, 6).map((e) => <li key={e.t + e.text} className={e.level}>{e.text}</li>)}
            {!p3.events.length && <li className="dim">Rien à signaler.</li>}
          </ul>
        </div>
        <div className="p3-col">
          <h3>Derniers incidents réparés</h3>
          <ul className="p1feed">
            {p3.stats.feed.map((f, i) => (
              <li key={f.pseudo + i}><span>{f.pseudo} · {INCIDENT_NAMES[f.incident] ?? f.incident}</span><b>{f.score}</b></li>
            ))}
            {!p3.stats.feed.length && <li className="dim">Personne pour l'instant</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
