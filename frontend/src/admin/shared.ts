import type { Field } from "../components/SchemaForm";
import type { PublicState, VisitorRow } from "../lib/types";

export interface Meta {
  phase_schemas: Record<string, Field[]>;
  content_schema: Field[];
  content_values: Record<string, any>;
  wifi: { ssid: string; security: string; has_password: boolean };
  custom_logo: boolean;
}
/** Exécute une action admin, notifie le résultat. */
export type Run = (fn: () => Promise<unknown>, okMsg?: string) => Promise<void>;
export interface TabProps { state: PublicState; meta: Meta; visitors: VisitorRow[]; run: Run }
