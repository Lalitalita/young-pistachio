import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useEvent } from "../lib/useEvent";
import Status from "../components/Status";
import Content from "../admin/Content";
import Pilotage from "../admin/Pilotage";
import QrPrint from "../admin/QrPrint";
import Texts from "../admin/Texts";
import Phase3 from "../admin/Phase3";
import Tools from "../admin/Tools";
import Visitors from "../admin/Visitors";
import type { Meta, Run } from "../admin/shared";

const TABS = [["pilotage", "Pilotage"], ["visiteurs", "Visiteurs"], ["panne", "Panne en prod"], ["qr", "QR codes"], ["contenu", "Contenu"], ["textes", "Textes"], ["outils", "Outils"]] as const;

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api("/api/admin/login", "POST", { password: pw }); onDone(); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Erreur"); }
  };
  return (
    <main className="admin login">
      <form className="card" onSubmit={submit}>
        <h1>Admin</h1>
        <label className="field"><span>Mot de passe</span>
          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn" type="submit">Entrer</button>
      </form>
    </main>
  );
}

export default function Admin() {
  const [auth, setAuth] = useState<boolean | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("pilotage");
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);
  const { state, visitors, connected } = useEvent("admin", auth === true);

  const loadMeta = useCallback(() => api<Meta>("/api/admin/meta").then(setMeta), []);
  useEffect(() => { api("/api/admin/me").then(() => setAuth(true), () => setAuth(false)); }, []);
  useEffect(() => { if (auth) loadMeta(); }, [auth, loadMeta, state?.branding]);

  const run: Run = async (fn, okMsg) => {
    try { await fn(); if (okMsg) setToast({ msg: okMsg }); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuth(false);
      setToast({ msg: e instanceof Error ? e.message : "Erreur", bad: true });
    }
    setTimeout(() => setToast(null), 3500);
  };

  if (auth === null) return <main className="admin"><p className="dim">…</p></main>;
  if (!auth) return <Login onDone={() => setAuth(true)} />;
  if (!state || !meta) return <main className="admin"><p className="dim">Chargement…</p></main>;

  const props = { state, meta, visitors, run };
  return (
    <main className="admin">
      <header className="row between noprint">
        <img className="logo" src={state.branding.logo_url} alt="" style={{ height: "2.2rem" }} />
        <span className="row"><span className="pill">{state.counts.connected} en ligne · {state.counts.day_total} aujourd'hui</span><Status connected={connected} />
          <button className="btn small ghost" onClick={() => api("/api/admin/logout", "POST").then(() => setAuth(false))}>Quitter</button></span>
      </header>
      <nav className="tabs noprint">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      {tab === "pilotage" && <Pilotage {...props} />}
      {tab === "visiteurs" && <Visitors {...props} />}
      {tab === "panne" && <Phase3 {...props} />}
      {tab === "qr" && <QrPrint {...props} />}
      {tab === "contenu" && <Content {...props} />}
      {tab === "textes" && <Texts run={run} />}
      {tab === "outils" && <Tools {...props} />}
      {toast && <div className={"toast" + (toast.bad ? " bad" : "")} role="alert">{toast.msg}</div>}
    </main>
  );
}
