export default function Status({ connected }: { connected: boolean }) {
  return (
    <span className="status" role="status">
      <span className={connected ? "dot on" : "dot"} />
      {connected ? "Connecté" : "Reconnexion…"}
    </span>
  );
}
