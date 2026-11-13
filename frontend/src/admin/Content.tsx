import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import SchemaForm from "../components/SchemaForm";
import type { TabProps } from "./shared";

export default function Content({ state, meta, run }: TabProps) {
  const [vals, setVals] = useState<Record<string, any>>(meta.content_values);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setVals(meta.content_values), [meta.content_values]);
  const upload = (f: File) => run(() => api("/api/admin/logo", "POST", undefined, { data: f, type: f.type }), "Logo mis à jour");
  return (
    <>
      <section className="card">
        <h2>Logo</h2>
        <div className="row">
          <img className="logo-prev" src={state.branding.logo_url} alt="logo actuel" />
          <input ref={file} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className="btn small" onClick={() => file.current?.click()}>Changer</button>
          <button className="btn small ghost" onClick={() => run(() => api("/api/admin/logo", "DELETE"), "Logo d'origine rétabli")}>Rétablir</button>
        </div>
        <p className="dim">SVG ou PNG (fond transparent, adapté à un fond sombre), 600 Ko max.</p>
      </section>
      <section className="card">
        <h2>Contenus & charte</h2>
        <SchemaForm schema={meta.content_schema} values={vals} onChange={setVals} />
        <button className="btn" onClick={() => run(() => api("/api/admin/content", "PUT", { values: vals }), "Contenus enregistrés")}>Enregistrer</button>
      </section>
    </>
  );
}
