import { useSocket } from "../lib/useSocket";
import Status from "./Status";

export default function Admin() {
  const connected = useSocket("admin");
  return (
    <main className="admin">
      <img className="logo" src="/brand/coda-logo.svg" alt="Coda" style={{ height: "2.4rem", alignSelf: "flex-start" }} />
      <h1>Admin</h1>
      <div className="card">Le panneau d'administration arrive à l'étape 1 (connexion par mot de passe incluse).</div>
      <Status connected={connected} />
    </main>
  );
}
