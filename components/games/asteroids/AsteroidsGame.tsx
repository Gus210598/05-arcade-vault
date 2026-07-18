"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { AsteroidsEngine, CANVAS_W, CANVAS_H, type AsteroidsState, type Phase } from "./engine";

export interface AsteroidsGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}

export interface AsteroidsGameProps {
  onStateChange: (state: AsteroidsState) => void;
  onGameOver: (finalScore: number) => void;
}

const CONTROL_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

const AsteroidsGame = forwardRef<AsteroidsGameHandle, AsteroidsGameProps>(function AsteroidsGame(
  { onStateChange, onGameOver },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const phaseRef = useRef<Phase>("playing");
  const pausedRef = useRef(false);
  const prevPhaseRef = useRef<Phase>("playing");
  const onStateChangeRef = useRef(onStateChange);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useImperativeHandle(ref, () => ({
    pause() {
      pausedRef.current = true;
      engineRef.current?.pause();
    },
    resume() {
      pausedRef.current = false;
      engineRef.current?.resume();
    },
    forceGameOver() {
      engineRef.current?.forceGameOver();
    },
    restart() {
      pausedRef.current = false;
      engineRef.current?.restart();
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const engine = new AsteroidsEngine(ctx, (state) => {
      phaseRef.current = state.phase;
      onStateChangeRef.current(state);
      if (state.phase === "gameover" && prevPhaseRef.current !== "gameover") {
        onGameOverRef.current(state.score);
      }
      prevPhaseRef.current = state.phase;
    });
    engineRef.current = engine;

    let rafId: number;
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      engine.update(dt);
      engine.draw();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // Listeners activos solo mientras el juego corre de verdad: en pausa o en
    // 'gameover' no se intercepta el teclado, para no interferir con el input
    // de iniciales del modal de fin de partida.
    const isActive = () =>
      !pausedRef.current && (phaseRef.current === "playing" || phaseRef.current === "dead");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!CONTROL_KEYS.has(e.code) || !isActive()) return;
      e.preventDefault();
      engine.handleKeyDown(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!CONTROL_KEYS.has(e.code)) return;
      engine.handleKeyUp(e.code);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
});

export default AsteroidsGame;
