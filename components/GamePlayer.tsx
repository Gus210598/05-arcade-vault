"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import {
  getStoredUserServerSnapshot,
  getStoredUserSnapshot,
  saveScoreEntry,
  subscribeStoredUser,
  type StoredUser,
} from "@/lib/auth";
import AsteroidsGame, {
  type AsteroidsGameHandle,
} from "@/components/games/asteroids/AsteroidsGame";
import type { AsteroidsState } from "@/components/games/asteroids/engine";

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const isAsteroids = game.id === "asteroides";

  const userJson = useSyncExternalStore(
    subscribeStoredUser,
    getStoredUserSnapshot,
    getStoredUserServerSnapshot,
  );
  const storedUser: StoredUser | null =
    userJson === "null" ? null : JSON.parse(userJson);

  const [score, setScore] = useState(0);
  const [lives] = useState(3);
  const level = Math.max(1, Math.floor(score / 2500) + 1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [customName, setCustomName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [asteroidsState, setAsteroidsState] = useState<AsteroidsState>({
    score: 0,
    lives: 3,
    level: 1,
    phase: "playing",
  });
  const asteroidsRef = useRef<AsteroidsGameHandle>(null);

  const displayScore = isAsteroids ? asteroidsState.score : score;
  const displayLives = isAsteroids ? asteroidsState.lives : lives;
  const displayLevel = isAsteroids ? asteroidsState.level : level;

  const name = customName ?? storedUser?.name ?? "INVITADO";

  useEffect(() => {
    if (isAsteroids || over || paused) return;
    const t = setInterval(() => {
      setScore((s) => s + Math.floor(10 + Math.random() * 90));
    }, 220);
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  const endGame = () => {
    if (isAsteroids) asteroidsRef.current?.forceGameOver();
    else setOver(true);
  };
  const restart = () => {
    if (isAsteroids) asteroidsRef.current?.restart();
    else setScore(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };
  const togglePause = () => {
    setPaused((p) => {
      const next = !p;
      if (isAsteroids) {
        if (next) asteroidsRef.current?.pause();
        else asteroidsRef.current?.resume();
      }
      return next;
    });
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{displayScore.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(displayLives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(displayLevel).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsGame
              ref={asteroidsRef}
              onStateChange={setAsteroidsState}
              onGameOver={() => setOver(true)}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{displayScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setCustomName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScoreEntry({ game: game.id, score: displayScore, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/juegos")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
