export default function Status({ connected }: { connected: boolean }) {
  return (
    <span className="status">
      <span className={connected ? "dot on" : "dot"} />
      {connected ? "Connecté" : "Reconnexion…"}
    </span>
  );
}
