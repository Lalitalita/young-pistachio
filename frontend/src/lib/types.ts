export type Role = "visitor" | "screen" | "admin";

export interface PhaseInfo {
  id: string; title: string; tagline: string; enabled: boolean; optional: boolean;
  params: Record<string, any>;
}
export interface Formation { title: string; level: string; description: string }
export interface Branding {
  school_name: string; event_title: string; event_date: string; event_place: string;
  next_workshop: string; color_brand: string; color_accent: string; color_bg: string;
  logo_url: string; formations: Formation[];
}
export interface ScreenSettings {
  mode: "auto" | "phase" | "attract"; phase_id: string; rotation_s: number;
  attract_after_s: number; show_wifi_qr: boolean; qr_use_host: boolean;
}
export type Bilingual = string | { curious: string; expert: string };
export interface P3Service { id: string; label: string; icon: string; kind: "container" | "service" | "physical"; status: "up" | "degraded" | "down" | "unknown"; ms: number | null }
export interface P3Boss {
  status: "idle" | "voting" | "recovering"; target: string | null; by: string | null; real: boolean;
  vote_ends_at: number | null; votes: number[]; total_votes: number;
  result: { total: number; correct: number; pct: number; answer: number } | null;
  cooldown_s: number; queue: string[]; queue_len: number; error: string | null;
}
export interface P3State {
  services: P3Service[]; events: { t: number; text: string; level: "ok" | "warn" | "bad" }[];
  pi_changed_at: number | null; pi_configured: boolean; boss: P3Boss;
  boss_content: { question: Bilingual; choices: Bilingual[]; answer: number; explanation: Bilingual };
  stats: {
    solved: number; avg_elapsed: number | null; top: { pseudo: string; score: number }[];
    fastest: { pseudo: string; elapsed: number } | null;
    feed: { pseudo: string; incident: string; score: number }[]; by_incident: Record<string, number>;
  };
}
export interface PublicState {
  server_time: number; mode: "free" | "guided"; phases: PhaseInfo[]; guided_open: string[];
  screen: ScreenSettings; attract: boolean;
  counts: { day_total: number; connected: number; by_phase: Record<string, number>; opt_in: number };
  content_v: number;
  branding: Branding;
  qr: { url: string; alt_url: string; ssid: string; wifi: boolean };
  demo: { enabled: boolean; count: number };
  recent: { pseudo: string }[];
  p3: P3State;
  p1: {
    count: number;
    strongest: { pseudo: string; score: number; offline_fast: number } | null;
    best_progress: { pseudo: string; delta: number } | null;
    top_pitfalls: { code: string; pct: number }[];
    feed: { pseudo: string; score: number; length: number; offline_fast: number }[];
  };
}
export interface Me {
  pseudo: string; phase: string; allowed: string[]; next: string | null; prev: string | null; next_locked: boolean;
  index: number; total: number; consent: boolean;
}
export interface VisitorRow {
  id: string; pseudo: string; hidden: boolean; phase: string; bot: boolean; connected: boolean; consent: boolean;
}
export type Send = (msg: Record<string, unknown>) => void;
