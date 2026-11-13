import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Run } from "./shared";

type TV = string | { curious: string; expert: string };
interface TextRow { key: string; default: TV; value: TV; overridden: boolean }
interface TermVal { label: string; simple: string; expert: string }
interface TermRow { key: string; default: TermVal | null; value: TermVal; overridden: boolean; custom: boolean }

const GROUPS: Record<string, string> = { ui: "Interface générale", p0: "Phase 0 · Accueil" };

function TextEditor({ row, run, reload }: { row: TextRow; run: Run; reload: () => void }) {
  const [v, setV] = useState<TV>(row.value);
  useEffect(() => setV(row.value), [row.value]);
  const dual = typeof row.default !== "string";
  const save = () => run(() => api(`/api/admin/texts/${row.key}`, "PUT", { value: v }).then(reload), "Texte enregistré");
  const reset = () => run(() => api(`/api/admin/texts/${row.key}`, "DELETE").then(reload), "Texte d'origine rétabli");
  return (
    <div className="textrow">
      <code>{row.key}</code>{row.overridden && <span className="pill">modifié</span>}
      {dual ? (
        <div className="form two">
          {(["curious", "expert"] as const).map((m) => (
            <label key={m} className="field"><span>{m === "curious" ? "🙂 Curieux" : "🛠 Expert"}</span>
              <textarea rows={3} value={(v as any)[m]} onChange={(e) => setV({ ...(v as any), [m]: e.target.value })} /></label>
          ))}
        </div>
      ) : <textarea rows={2} value={v as string} onChange={(e) => setV(e.target.value)} />}
      <div className="row"><button className="btn small" onClick={save}>Enregistrer</button>
        {row.overridden && <button className="btn small ghost" onClick={reset}>Rétablir</button>}</div>
    </div>
  );
}

function TermEditor({ row, run, reload }: { row: TermRow; run: Run; reload: () => void }) {
  const [v, setV] = useState<TermVal>(row.value);
  useEffect(() => setV(row.value), [row.value]);
  const save = () => run(() => api(`/api/admin/glossary/${row.key}`, "PUT", { value: v }).then(reload), "Terme enregistré");
  const reset = () => run(() => api(`/api/admin/glossary/${row.key}`, "DELETE").then(reload), row.custom ? "Terme supprimé" : "Terme d'origine rétabli");
  return (
    <details className="textrow">
      <summary><b>{row.value.label}</b> <code>[[{row.key}]]</code>{row.overridden && <span className="pill">{row.custom ? "ajouté" : "modifié"}</span>}</summary>
      <label className="field"><span>Mot affiché</span><input type="text" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} /></label>
      <label className="field"><span>Explication simple</span><textarea rows={2} value={v.simple} onChange={(e) => setV({ ...v, simple: e.target.value })} /></label>
      <label className="field"><span>En plus, en mode expert</span><textarea rows={2} value={v.expert} onChange={(e) => setV({ ...v, expert: e.target.value })} /></label>
      <div className="row"><button className="btn small" onClick={save}>Enregistrer</button>
        {row.overridden && <button className="btn small ghost" onClick={reset}>{row.custom ? "Supprimer" : "Rétablir"}</button>}</div>
    </details>
  );
}

export default function Texts({ run }: { run: Run }) {
  const [texts, setTexts] = useState<TextRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [q, setQ] = useState("");
  const [nk, setNk] = useState("");
  const reload = useCallback(() => api("/api/admin/texts").then((d) => { setTexts(d.texts); setTerms(d.glossary); }), []);
  useEffect(() => { reload(); }, [reload]);

  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const grouped = Object.entries(GROUPS).map(([g, title]) => ({
    g, title, rows: texts.filter((r) => r.key.startsWith(g + ".") && (match(r.key) || match(JSON.stringify(r.value)))),
  })).filter((x) => x.rows.length);

  return (
    <>
      <section className="card">
        <h2>Textes des étapes</h2>
        <p className="dim">Chaque texte existe en version « curieuse » (simple) et « expert » (technique). Écris <code>[[dns|DNS]]</code> pour rendre un mot cliquable (infobulle du glossaire). Les changements sont visibles tout de suite sur les téléphones.</p>
        <input type="text" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        {grouped.map(({ g, title, rows }) => (
          <details key={g} open={g === "p0" || !!q} className="group"><summary><h3>{title} <span className="pill">{rows.length}</span></h3></summary>
            {rows.map((r) => <TextEditor key={r.key} row={r} run={run} reload={reload} />)}</details>
        ))}
      </section>
      <section className="card">
        <h2>Glossaire</h2>
        <p className="dim">Définitions des mots techniques (infobulles). Tu peux en ajouter, puis les utiliser dans un texte avec <code>[[identifiant]]</code>.</p>
        {terms.filter((r) => match(r.key) || match(r.value.label)).map((r) => <TermEditor key={r.key} row={r} run={run} reload={reload} />)}
        <div className="row wrap addterm">
          <input type="text" placeholder="nouvel-identifiant" value={nk} onChange={(e) => setNk(e.target.value.toLowerCase())} />
          <button className="btn small" disabled={!nk}
            onClick={() => run(() => api(`/api/admin/glossary/${nk}`, "PUT", { value: { label: nk, simple: "À définir.", expert: "" } }).then(() => { setNk(""); reload(); }), "Terme ajouté : édite-le ci-dessus")}>+ Ajouter un terme</button>
        </div>
      </section>
    </>
  );
}
