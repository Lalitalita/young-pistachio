import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Rich, T, useContent } from "../../lib/content";
import { interpolate, plain } from "../../lib/richtext";
import type { Bilingual } from "../../lib/types";
import type { MobileProps } from "../types";
import { pick, useCountdown } from "./shared";

interface Clue { index: number; kind: string; label: string; text: Bilingual }
interface Incident {
  id: string; icon: string; title: Bilingual; symptom: Bilingual; clue_total: number;
  clues: Clue[]; clue_labels: { index: number; kind: string; label: string }[];
  choices: { id: number; text: Bilingual }[]; wrong: number[]; done: boolean; score: number | null;
  elapsed: number | null; fix?: Bilingual; lesson?: Bilingual; solved_count: number;
}
const CLUE_COST = 12, WRONG_COST = 15;
const KIND_ICON: Record<string, string> = { ping: "📡", log: "📜", error: "⚠️" };

export default function Mobile({ info, state, me, send }: MobileProps) {
  const { t, mode } = useContent();
  const [inc, setInc] = useState<Incident | null>(null);
  const [repair, setRepair] = useState<"idle" | "running" | "done">("idle");
  const [error, setError] = useState("");
  const [bossMsg, setBossMsg] = useState("");
  const [myVote, setMyVote] = useState<{ run: number; choice: number } | null>(null);

  const p3 = state.p3, boss = p3.boss, bc = p3.boss_content;
  const left = useCountdown(boss.vote_ends_at, state.server_time);
  const run = boss.vote_ends_at ?? 0;
  const voted = myVote && myVote.run === run ? myVote.choice : null;

  useEffect(() => { api<Incident>("/api/phase3/incident").then((i) => { setInc(i); if (i.done) setRepair("done"); }).catch(() => {}); }, []);

  const act = async (fn: () => Promise<Incident>) => {
    setError("");
    try { setInc(await fn()); } catch (e) { setError(e instanceof ApiError ? e.message : "Connexion perdue, réessaie."); }
  };
  const clue = (i: number) => act(() => api<Incident>("/api/phase3/clue", "POST", { index: i }));
  const diagnose = (choice: number) => act(async () => (await api("/api/phase3/diagnose", "POST", { choice })).incident);
  const another = () => { setRepair("idle"); setBossMsg(""); return act(() => api<Incident>("/api/phase3/next", "POST")); };
  const doRepair = () => { setRepair("running"); window.setTimeout(() => setRepair("done"), 1600); };

  const requestBoss = async () => {
    setBossMsg("");
    try {
      const r = await api<{ state: string; position?: number; reason?: string }>("/api/phase3/boss/request", "POST");
      if (r.state === "queued") setBossMsg(interpolate(t("p3.boss_queued"), { pos: r.position ?? 1 }));
      else if (r.state === "disabled") setBossMsg(t("p3.boss_disabled"));
      else if (r.state === "error") setBossMsg(t("p3.boss_error"));
    } catch (e) { setBossMsg(e instanceof ApiError ? e.message : t("p3.boss_error")); }
  };
  const vote = async (choice: number) => {
    setMyVote({ run, choice });
    try { await api("/api/phase3/boss/vote", "POST", { choice }); } catch { setMyVote(null); }
  };

  if (!inc) return <div className="card phase">{t("ui.loading", "Chargement…")}</div>;
  const solved = inc.done;
  const bossOn = info.params.boss_enabled !== false;

  return (
    <div className="p3">
      <section className="card phase">
        <h2><T k="p3.title" /></h2>
        <p><T k="p3.intro" /></p>
      </section>

      <section className="card phase incident">
        <h3><span aria-hidden>{inc.icon}</span> <Rich text={pick(inc.title, mode)} /></h3>
        <p><Rich text={pick(inc.symptom, mode)} /></p>

        <h4><T k="p3.clues_title" /></h4>
        {!solved && <p className="dim small"><T k="p3.clues_hint" vars={{ cost: CLUE_COST }} /></p>}
        <ul className="clues">
          {inc.clue_labels.map((c) => {
            const got = inc.clues.find((x) => x.index === c.index);
            return (
              <li key={c.index} className={got ? "open" : ""}>
                {got ? (
                  <>
                    <b>{KIND_ICON[c.kind]} <Rich text={c.label} /></b>
                    <pre className={mode === "expert" ? "mono" : ""}>{pick(got.text, mode)}</pre>
                  </>
                ) : (
                  <button className="btn ghost" disabled={solved} onClick={() => clue(c.index)}>
                    {KIND_ICON[c.kind]} {plain(c.label)} <small>(−{CLUE_COST})</small>
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {!solved && (
          <>
            <h4><T k="p3.diag_title" /></h4>
            <div className="choices">
              {inc.choices.map((c) => {
                const bad = inc.wrong.includes(c.id);
                return (
                  <button key={c.id} className={"btn choice" + (bad ? " wrong" : "")} disabled={bad} onClick={() => diagnose(c.id)}>
                    {bad ? "✗ " : ""}{plain(pick(c.text, mode))}
                  </button>
                );
              })}
            </div>
            {inc.wrong.length > 0 && <p className="err"><T k="p3.wrong" vars={{ cost: WRONG_COST }} /></p>}
          </>
        )}
        {error && <p className="err">{error}</p>}

        {solved && repair === "idle" && (
          <button className="btn big" onClick={doRepair}>{plain(interpolate(t("p3.repair"), { fix: pick(inc.fix, mode) }))}</button>
        )}
        {solved && repair === "running" && (
          <div className="repairing" role="status"><span>{t("p3.repairing")}</span><div className="gauge"><div className="gauge-bar fill" /></div></div>
        )}
        {solved && repair === "done" && (
          <div className="p3-result">
            <p className="verdict ok"><T k="p3.fixed" /></p>
            <p className="score"><T k="p3.score" vars={{ score: Math.round(inc.score ?? 0), sec: Math.round(inc.elapsed ?? 0) }} /></p>
            <h4><T k="p3.lesson_title" /></h4>
            <p><Rich text={pick(inc.lesson, mode)} /></p>
          </div>
        )}
      </section>

      {solved && repair === "done" && (
        <section className={"card phase boss" + (boss.status !== "idle" ? " live" : "")}>
          <h3><T k="p3.boss_title" /></h3>

          {boss.status === "idle" && (
            <>
              <p><T k="p3.boss_intro" /></p>
              {!bossOn ? <p className="dim"><T k="p3.boss_disabled" /></p> : (
                <button className="btn big warn" onClick={requestBoss} disabled={boss.cooldown_s > 0 && boss.queue_len > 5}>
                  {plain(t("p3.boss_btn"))}
                </button>
              )}
              {boss.cooldown_s > 0 && bossOn && <p className="dim small"><T k="p3.boss_cooldown" vars={{ sec: boss.cooldown_s }} /></p>}
              {boss.queue_len > 0 && <p className="dim small">⏳ {boss.queue_len} en attente</p>}
              {bossMsg && <p className="note">{bossMsg}</p>}
            </>
          )}

          {boss.status === "voting" && (
            <>
              <p className="dim"><T k="p3.boss_busy" /> {boss.by && <b>({boss.by})</b>}</p>
              <h4><T k="p3.vote_title" /></h4>
              <p className="countdown"><T k="p3.vote_left" vars={{ sec: left }} /></p>
              <div className="choices">
                {bc.choices.map((c, i) => (
                  <button key={i} className={"btn choice" + (voted === i ? " picked" : "")} disabled={voted !== null} onClick={() => vote(i)}>
                    {voted === i ? "✔ " : ""}{plain(pick(c, mode))}
                  </button>
                ))}
              </div>
              {voted !== null && <p className="note"><T k="p3.voted" /></p>}
            </>
          )}

          {boss.status === "recovering" && boss.result && (
            <>
              <p className="verdict ok"><T k="p3.result" vars={{ pct: boss.result.pct, correct: boss.result.correct, total: boss.result.total }} /></p>
              {voted !== null && <p className="note"><T k={voted === bc.answer ? "p3.result_good" : "p3.result_bad"} /></p>}
              <p><Rich text={pick(bc.explanation, mode)} /></p>
            </>
          )}
        </section>
      )}

      {solved && repair === "done" && (
        <div className="row">
          <button className="btn ghost" onClick={another}><T k="p3.another" /></button>
          <button className="btn big" disabled={me.next_locked} onClick={() => send({ type: "advance" })}>
            {me.next_locked ? t("ui.waiting_host", "En attente de l'animateur…") : t("p3.continue")}
          </button>
        </div>
      )}
    </div>
  );
}
