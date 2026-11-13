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
export interface PublicState {
  server_time: number; mode: "free" | "guided"; phases: PhaseInfo[]; guided_open: string[];
  screen: ScreenSettings; attract: boolean;
  counts: { day_total: number; connected: number; by_phase: Record<string, number> };
  branding: Branding;
  qr: { url: string; alt_url: string; ssid: string; wifi: boolean };
  demo: { enabled: boolean; count: number };
  recent: { pseudo: string }[];
}
export interface Me {
  pseudo: string; phase: string; allowed: string[]; next: string | null; next_locked: boolean;
  index: number; total: number; consent: boolean;
}
export interface VisitorRow {
  id: string; pseudo: string; hidden: boolean; phase: string; bot: boolean; connected: boolean; consent: boolean;
}
export type Send = (msg: Record<string, unknown>) => void;
