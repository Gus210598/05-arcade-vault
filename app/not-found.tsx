import Link from "next/link";

export default function NotFound() {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-magenta flicker" style={{ fontSize: 28 }}>
            404
          </h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            SEÑAL PERDIDA · CARTUCHO NO ENCONTRADO
          </div>
        </div>

        <p
          style={{
            color: "var(--ink-dim)",
            fontSize: 13,
            lineHeight: 1.7,
            margin: "0 0 20px",
          }}
        >
          El juego que buscás no existe en esta bóveda. Puede que el cartucho se
          haya extraviado en el tiempo.
        </p>

        <Link className="btn lg" href="/juegos" style={{ width: "100%" }}>
          VOLVER AL VAULT
        </Link>
      </div>
    </div>
  );
}
