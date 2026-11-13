import { useSocket } from "../lib/useSocket";
import Status from "./Status";

export default function Visitor() {
  const connected = useSocket("visitor");
  return (
    <main className="page">
      <img className="logo" src="/brand/coda-logo.svg" alt="Coda" />
      <section className="hero">
        <h1>Bienvenue au <em>Cyber Parcours</em></h1>
        <p>Étape 0 : le squelette tourne. Le parcours arrive bientôt !</p>
      </section>
      <Status connected={connected} />
    </main>
  );
}
