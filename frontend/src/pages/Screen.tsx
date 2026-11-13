import { Suspense, useEffect, useRef, useState } from "react";
import { useEvent } from "../lib/useEvent";
import { screenView } from "../lib/phaseLogic";
import type { PublicState } from "../lib/types";
import Status from "../components/Status";
import { PHASES } from "../phases/registry";

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Compteur qui « roule » vers sa nouvelle valeur. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(Math.round(a + (value - a) * k));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

const NODES = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 37 + 11) % 100, y: (i * 53 + 7) % 100, s: 0.6 + ((i * 7) % 10) / 8, d: (i * 0.7) % 6,
}));

function Attract({ state }: { state: PublicState }) {
  const b = state.branding;
  const tips = state.phases.filter((p) => p.enabled && p.id !== "p0");
  const now = useNow(4000);
  const tip = tips.length ? tips[Math.floor(now / 4000) % tips.length] : null;
  return (
    <div className="attract">
      <div className="nodes" aria-hidden>
        {NODES.map((n, i) => <span key={i} style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${n.s}vw`, height: `${n.s}vw`, animationDelay: `${n.d}s` }} />)}
      </div>
      <div className="attract-main">
        <div className="attract-left">
          <img className="logo" src={b.logo_url} alt={b.school_name} />
          <h1>Cyber <em>Parcours</em></h1>
          <p className="lead">Scanne, joue, et découvre comment on se fait vraiment pirater.</p>
          {tip && <p className="tip" key={tip.id}>« {tip.title} »</p>}
          <p className="event">{b.event_title}<br />{b.event_date}<br />{b.event_place}</p>
        </div>
        <div className="attract-qr">
          {state.qr.wifi && (
            <figure><img src="/api/qr/wifi.svg" alt="QR code de connexion au Wi-Fi" />
              <figcaption><b>1.</b> Connecte-toi au Wi-Fi<small>{state.qr.ssid}</small></figcaption></figure>
          )}
          <figure className="main"><img src="/api/qr/url.svg" alt="QR code pour ouvrir le parcours" />
            <figcaption><b>{state.qr.wifi ? "2." : "→"}</b> Ouvre le parcours<small>{state.qr.url.replace("http://", "")}</small></figcaption></figure>
        </div>
      </div>
    </div>
  );
}

export default function Screen() {
  const { state, connected } = useEvent("screen");
  const now = useNow(1000);
  if (!state) return <main className="screen"><p className="dim">Connexion…</p><Status connected={connected} /></main>;

  const view = screenView(state, now);
  const info = view.kind === "phase" ? state.phases.find((p) => p.id === view.id)! : null;
  const plugin = info ? PHASES[info.id] : null;

  return (
    <main className="screen">
      {view.kind === "attract" ? <Attract state={state} /> : (
        <div className="phase-wrap" key={view.id}>
          <Suspense fallback={null}>{plugin && <plugin.Screen info={info!} state={state} />}</Suspense>
        </div>
      )}
      <footer className="screenbar">
        <span className="counter"><b><CountUp value={state.counts.day_total} /></b> visiteur{state.counts.day_total > 1 ? "s" : ""} aujourd'hui</span>
        <span className="counter live"><i className="pulse" /> <b><CountUp value={state.counts.connected} /></b> en ligne</span>
        {state.recent.length > 0 && (
          <span className="ticker" key={state.recent[state.recent.length - 1].pseudo}>
            👋 {state.recent[state.recent.length - 1].pseudo} vient d'arriver
          </span>
        )}
        <Status connected={connected} />
      </footer>
    </main>
  );
}
