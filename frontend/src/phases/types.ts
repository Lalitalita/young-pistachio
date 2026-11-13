import type { ComponentType } from "react";
import type { Me, PhaseInfo, PublicState, Send } from "../lib/types";

export interface MobileProps { info: PhaseInfo; state: PublicState; me: Me; send: Send }
export interface ScreenProps { info: PhaseInfo; state: PublicState }

/** Un plugin de phase = composants mobile + écran (+ préchargement en tâche de fond).
 *  Manifeste (titre, paramètres) : backend/app/phases.py. */
export interface PhasePlugin {
  Mobile: ComponentType<MobileProps>;
  Screen: ComponentType<ScreenProps>;
  /** Appelé pendant l'intro (temps libre du processeur) pour ménager les vieux téléphones. */
  preload: () => Promise<unknown>;
}
