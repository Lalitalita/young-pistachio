export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function detail(d: unknown): string {
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg ?? "").filter(Boolean).join(" ; ") || "Requête invalide";
  return "Erreur";
}

export async function api<T = any>(path: string, method = "GET", body?: unknown, raw?: { data: Blob; type: string }): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (raw) { init.body = raw.data; init.headers = { "Content-Type": raw.type }; }
  else if (body !== undefined) { init.body = JSON.stringify(body); init.headers = { "Content-Type": "application/json" }; }
  const r = await fetch(path, init);
  if (!r.ok) {
    let d: unknown = r.statusText;
    try { d = (await r.json()).detail; } catch { /* corps non JSON */ }
    throw new ApiError(r.status, detail(d));
  }
  return (r.status === 204 ? null : await r.json()) as T;
}
