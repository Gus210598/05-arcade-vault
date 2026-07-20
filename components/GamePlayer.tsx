"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import {
  getStoredUserServerSnapshot,
  getStoredUserSnapshot,
  saveScoreEntry,
  subscribeStoredUser,
  type StoredUser,
} from "@/lib/auth";
import { saveScoreToSupabase } from "@/lib/scores-client";
import { engineRegistry } from "@/components/games/registry";
import type { AsteroidsGameHandle } from "@/components/games/asteroids/AsteroidsGame";
import type { AsteroidsState } from "@/components/games/asteroids/engine";
import type { TetrisGameHandle } from "@/components/games/tetris/TetrisGame";
import { THEMES, type TetrisState, type ThemeId } from "@/components/games/tetris/engine";
import type { ArkanoidGameHandle } from "@/components/games/arkanoid/ArkanoidGame";
import type { ArkanoidState } from "@/components/games/arkanoid/engine";

const TETRIS_THEME_KEY = "av_tetris_theme";
const ARKANOID_MUTED_KEY = "av_arkanoid_muted";
const THEME_OPTIONS = Object.values(THEMES);

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const isAsteroids = game.id === "asteroides";
  const isTetris = game.id === "tetris";
  const isArkanoid = game.id === "arkanoid";
  const GameComponent = engineRegistry[game.id];

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

  const [tetrisState, setTetrisState] = useState<TetrisState>({
    score: 0,
    lines: 0,
    level: 1,
    phase: "playing",
  });
  const tetrisRef = useRef<TetrisGameHandle>(null);
  const [tetrisTheme, setTetrisTheme] = useState<ThemeId>("retro");

  const [arkanoidState, setArkanoidState] = useState<ArkanoidState>({
    score: 0,
    lives: 3,
    level: 1,
    phase: "playing",
    won: false,
  });
  const arkanoidRef = useRef<ArkanoidGameHandle>(null);
  const [arkanoidMuted, setArkanoidMuted] = useState(false);

  const displayScore = isAsteroids
    ? asteroidsState.score
    : isTetris
      ? tetrisState.score
      : isArkanoid
        ? arkanoidState.score
        : score;
  const displayLives = isAsteroids
    ? asteroidsState.lives
    : isArkanoid
      ? arkanoidState.lives
      : lives;
  const displayLevel = isAsteroids
    ? asteroidsState.level
    : isTetris
      ? tetrisState.level
      : isArkanoid
        ? arkanoidState.level
        : level;

  const name = customName ?? storedUser?.name ?? "INVITADO";

  useEffect(() => {
    if (isAsteroids || isTetris || isArkanoid || over || paused) return;
    const t = setInterval(() => {
      setScore((s) => s + Math.floor(10 + Math.random() * 90));
    }, 220);
    return () => clearInterval(t);
  }, [isAsteroids, isTetris, isArkanoid, over, paused]);

  // Al montar Tetris, retoma el tema guardado y lo aplica al engine real antes
  // del primer frame (setTheme() se ejecuta en fase de efectos, antes de que
  // el rAF del engine pinte, así que no hay parpadeo visible).
  useEffect(() => {
    if (!isTetris) return;
    const stored = window.localStorage.getItem(TETRIS_THEME_KEY);
    const initial: ThemeId = stored && stored in THEMES ? (stored as ThemeId) : "retro";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage no es legible en SSR; sync inicial inevitable, sin parpadeo (ver comentario arriba)
    setTetrisTheme(initial);
    tetrisRef.current?.setTheme(initial);
  }, [isTetris]);

  // Mismo criterio que el tema de Tetris: retoma la preferencia de sonido
  // guardada y la aplica al engine real antes del primer frame audible.
  useEffect(() => {
    if (!isArkanoid) return;
    const stored = window.localStorage.getItem(ARKANOID_MUTED_KEY) === "true";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage no es legible en SSR; sync inicial inevitable, sin parpadeo (ver comentario del tema de Tetris)
    setArkanoidMuted(stored);
    arkanoidRef.current?.setMuted(stored);
  }, [isArkanoid]);

  const endGame = () => {
    if (isAsteroids) asteroidsRef.current?.forceGameOver();
    else if (isTetris) tetrisRef.current?.forceGameOver();
    else if (isArkanoid) arkanoidRef.current?.forceGameOver();
    else setOver(true);
  };
  const restart = () => {
    if (isAsteroids) asteroidsRef.current?.restart();
    else if (isTetris) tetrisRef.current?.restart();
    else if (isArkanoid) arkanoidRef.current?.restart();
    else setScore(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };
  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      if (isAsteroids) {
        if (next) asteroidsRef.current?.pause();
        else asteroidsRef.current?.resume();
      } else if (isTetris) {
        if (next) tetrisRef.current?.pause();
        else tetrisRef.current?.resume();
      } else if (isArkanoid) {
        if (next) arkanoidRef.current?.pause();
        else arkanoidRef.current?.resume();
      }
      return next;
    });
  }, [isAsteroids, isTetris, isArkanoid]);

  // KeyP/Escape reusan el mismo togglePause() del botón PAUSA, para que el
  // label y el overlay "EN PAUSA" nunca queden desincronizados del engine
  // real. Tetris solo pide "P" (spec 07); Arkanoid pide "P" y "Escape"
  // (spec 08) — Asteroids no pide ninguno y se deja fuera, sin cambiarle
  // comportamiento.
  useEffect(() => {
    if (!isTetris && !isArkanoid) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isPauseKey =
        e.code === "KeyP" || (isArkanoid && e.code === "Escape");
      if (!isPauseKey || over) return;
      togglePause();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTetris, isArkanoid, over, togglePause]);

  const handleThemeChange = (id: ThemeId) => {
    setTetrisTheme(id);
    tetrisRef.current?.setTheme(id);
    window.localStorage.setItem(TETRIS_THEME_KEY, id);
  };

  const toggleMute = () => {
    setArkanoidMuted((m) => {
      const next = !m;
      arkanoidRef.current?.setMuted(next);
      window.localStorage.setItem(ARKANOID_MUTED_KEY, String(next));
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
          {isTetris ? (
            <div className="hud-stat">
              <div className="l">Líneas</div>
              <div className="v">{tetrisState.lines}</div>
            </div>
          ) : (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(displayLives).trim() || "—"}</div>
            </div>
          )}
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(displayLevel).padStart(2, "0")}</div>
          </div>
          {isTetris && (
            <div className="theme-picker">
              <div className="l">Paleta</div>
              <div className="theme-swatches">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-swatch${tetrisTheme === t.id ? " active" : ""}`}
                    aria-pressed={tetrisTheme === t.id}
                    onClick={() => handleThemeChange(t.id)}
                  >
                    <span className="swatch-icon" aria-hidden="true">
                      <i style={{ background: t.colors[0] }} />
                      <i style={{ background: t.colors[1] }} />
                      <i style={{ background: t.colors[2] }} />
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          {isArkanoid && (
            <button
              className="btn ghost"
              aria-pressed={arkanoidMuted}
              onClick={toggleMute}
            >
              {arkanoidMuted ? "SONIDO" : "SILENCIAR"}
            </button>
          )}
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {GameComponent ? (
            <GameComponent
              ref={isAsteroids ? asteroidsRef : isTetris ? tetrisRef : arkanoidRef}
              onStateChange={
                isAsteroids
                  ? setAsteroidsState
                  : isTetris
                    ? setTetrisState
                    : setArkanoidState
              }
              onGameOver={() => setOver(true)}
              {...(isTetris ? { initialTheme: tetrisTheme } : {})}
              {...(isArkanoid
                ? { onPauseChange: setPaused, initialMuted: arkanoidMuted }
                : {})}
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
          {paused && !isArkanoid && (
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
                  onClick={async () => {
                    if (game.hasRealBackend) {
                      try {
                        await saveScoreToSupabase({
                          gameId: game.id,
                          playerName: name,
                          score: displayScore,
                        });
                      } catch (err) {
                        console.error("No se pudo guardar la puntuación", err);
                      }
                    } else {
                      saveScoreEntry({ game: game.id, score: displayScore, name });
                    }
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
