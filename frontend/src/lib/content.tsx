import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { interpolate, Mode, parseRich, pickText, TextValue } from "./richtext";

interface Glossary { [key: string]: { label: string; simple: string; expert: string } }
interface Ctx {
  mode: Mode; setMode: (m: Mode) => void;
  t: (key: string, fallback?: string) => string;
  glossary: Glossary; openTerm: string | null; setOpenTerm: (k: string | null) => void;
}
const C = createContext<Ctx | null>(null);
export const useContent = () => useContext(C)!;

const KEY = "cp_mode";
const loadMode = (): Mode => { try { return localStorage.getItem(KEY) === "expert" ? "expert" : "curious"; } catch { return "curious"; } };

/** Textes éditables + glossaire + mode curieux/expert (mémorisé sur l'appareil). */
export function ContentProvider({ version, children }: { version: number; children: ReactNode }) {
  const [texts, setTexts] = useState<Record<string, TextValue>>({});
  const [glossary, setGlossary] = useState<Glossary>({});
  const [mode, setModeState] = useState<Mode>(loadMode);
  const [openTerm, setOpenTerm] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api("/api/content").then((c) => { if (live) { setTexts(c.texts); setGlossary(c.glossary); } }).catch(() => {});
    return () => { live = false; };
  }, [version]); // rechargé quand l'admin modifie un texte

  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem(KEY, m); } catch { /* stockage indisponible */ } };
  const t = useCallback((k: string, fb = "") => pickText(texts, k, mode, fb), [texts, mode]);
  const term = openTerm ? glossary[openTerm] : null;

  return (
    <C.Provider value={{ mode, setMode, t, glossary, openTerm, setOpenTerm }}>
      {children}
      {term && (
        <div className="sheet-back" onClick={() => setOpenTerm(null)}>
          <aside className="sheet" role="dialog" aria-label={term.label} onClick={(e) => e.stopPropagation()}>
            <h3>{term.label}</h3>
            <p>{term.simple}</p>
            {mode === "expert" && term.expert && <p className="expert"><b>En expert :</b> {term.expert}</p>}
            <button className="btn small" onClick={() => setOpenTerm(null)}>Compris</button>
          </aside>
        </div>
      )}
    </C.Provider>
  );
}

/** Texte avec mots de glossaire cliquables (infobulle). */
export function Rich({ text }: { text: string }) {
  const { glossary, setOpenTerm } = useContent();
  return (
    <>
      {parseRich(text).map((p, i) =>
        p.type === "text" ? <span key={i}>{p.text}</span> : (
          <button key={i} type="button" className="term" onClick={() => setOpenTerm(p.key)}>
            {p.label ?? glossary[p.key]?.label ?? p.key}
          </button>
        ),
      )}
    </>
  );
}

/** Texte éditable par clé, selon le mode. */
export function T({ k, fallback, vars }: { k: string; fallback?: string; vars?: Record<string, string | number> }) {
  const { t } = useContent();
  return <Rich text={interpolate(t(k, fallback), vars)} />;
}

export function ModeToggle() {
  const { mode, setMode, t } = useContent();
  return (
    <div className="modetoggle" role="group" aria-label={t("ui.mode_label", "Niveau d'explication")}>
      {(["curious", "expert"] as const).map((m) => (
        <button key={m} className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>
          {t(m === "curious" ? "ui.mode_curious" : "ui.mode_expert", m === "curious" ? "Curieux" : "Expert")}
        </button>
      ))}
    </div>
  );
}
