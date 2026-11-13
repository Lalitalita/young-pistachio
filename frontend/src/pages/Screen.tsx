import { useSocket } from "../lib/useSocket";
import Status from "./Status";

export default function Screen() {
  const connected = useSocket("screen");
  return (
    <main className="screen">
      <div>
        <img className="logo" src="/brand/coda-logo.svg" alt="Coda" />
        <h1>Cyber <em>Parcours</em></h1>
        <p>Grand écran : en attente de l'étape 1</p>
      </div>
      <Status connected={connected} />
    </main>
  );
}
