import type { ReactNode } from "react";

export interface Field {
  key: string; label: string; type: "string" | "text" | "number" | "boolean" | "color" | "select" | "list";
  default?: any; min?: number; max?: number; int?: boolean; help?: string;
  options?: { value: string; label: string }[]; fields?: Field[]; max_items?: number;
}
type Values = Record<string, any>;

function blank(fields: Field[]): Values {
  return Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === "boolean" ? false : "")]));
}

/** Formulaire généré depuis un schéma (même schéma que la validation serveur). */
export default function SchemaForm({ schema, values, onChange }: { schema: Field[]; values: Values; onChange: (v: Values) => void }) {
  const set = (k: string, v: any) => onChange({ ...values, [k]: v });
  return (
    <div className="form">
      {schema.map((f) => {
        const v = values[f.key];
        let input: ReactNode;
        switch (f.type) {
          case "boolean":
            return (
              <label key={f.key} className="field switch">
                <input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} />
                <span>{f.label}</span>
                {f.help && <small>{f.help}</small>}
              </label>
            );
          case "number":
            input = <input type="number" value={v ?? ""} min={f.min} max={f.max}
              onChange={(e) => set(f.key, e.target.value === "" ? "" : Number(e.target.value))} />;
            break;
          case "color":
            input = <span className="colorrow"><input type="color" value={v} onChange={(e) => set(f.key, e.target.value)} />
              <code>{v}</code></span>;
            break;
          case "text":
            input = <textarea rows={2} value={v ?? ""} onChange={(e) => set(f.key, e.target.value)} />;
            break;
          case "select":
            input = <select value={v} onChange={(e) => set(f.key, e.target.value)}>
              {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
            break;
          case "list": {
            const items: Values[] = v ?? [];
            input = (
              <div className="list">
                {items.map((it, i) => (
                  <div className="card sub" key={i}>
                    <SchemaForm schema={f.fields!} values={it}
                      onChange={(nv) => set(f.key, items.map((x, j) => (j === i ? nv : x)))} />
                    <button type="button" className="btn small ghost" onClick={() => set(f.key, items.filter((_, j) => j !== i))}>Retirer</button>
                  </div>
                ))}
                {items.length < (f.max_items ?? 10) && (
                  <button type="button" className="btn small ghost" onClick={() => set(f.key, [...items, blank(f.fields!)])}>+ Ajouter</button>
                )}
              </div>
            );
            break;
          }
          default:
            input = <input type="text" value={v ?? ""} onChange={(e) => set(f.key, e.target.value)} />;
        }
        return (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            {input}
            {f.help && <small>{f.help}</small>}
          </label>
        );
      })}
    </div>
  );
}
