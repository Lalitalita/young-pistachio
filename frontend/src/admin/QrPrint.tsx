import type { TabProps } from "./shared";

export default function QrPrint({ state, meta }: TabProps) {
  return (
    <section className="card">
      <div className="row between noprint">
        <h2>QR codes à imprimer</h2>
        <button className="btn" onClick={() => window.print()}>🖨️ Imprimer</button>
      </div>
      <p className="dim noprint">Le Wi-Fi vient de <code>.env</code> (WIFI_SSID, WIFI_PASSWORD). Mot de passe Wi-Fi {meta.wifi.has_password ? "renseigné" : "absent"}.</p>
      <div className="print-sheet">
        <h1>{state.branding.event_title} · {state.branding.school_name}</h1>
        <div className="qrgrid">
          {meta.wifi.ssid ? (
            <figure><img src="/api/qr/wifi.svg" alt="QR Wi-Fi" />
              <figcaption><b>1. Connecte-toi au Wi-Fi</b><br />{meta.wifi.ssid}</figcaption></figure>
          ) : <p className="dim">WIFI_SSID non configuré dans .env</p>}
          <figure><img src="/api/qr/url.svg" alt="QR du parcours" />
            <figcaption><b>2. Ouvre le Cyber Parcours</b><br />{state.qr.url.replace("http://", "")}<br />
              <small>secours : {state.qr.alt_url.replace("http://", "")}</small></figcaption></figure>
        </div>
        <p className="help">Pas de page qui s'ouvre ? Désactive le « DNS privé » (Android) ou « Relais privé iCloud » (iPhone) pour ce Wi-Fi.</p>
      </div>
    </section>
  );
}
