"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  TetrisEngine,
  CANVAS_W,
  CANVAS_H,
  NEXT_CANVAS_W,
  NEXT_CANVAS_H,
  type TetrisState,
  type Phase,
  type ThemeId,
} from "./engine";

export interface TetrisGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
  setTheme(theme: ThemeId): void;
}

export interface TetrisGameProps {
  onStateChange: (state: TetrisState) => void;
  onGameOver: (finalScore: number) => void;
  initialTheme?: ThemeId;
}

const CONTROL_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "KeyX",
  "Space",
]);

const TetrisGame = forwardRef<TetrisGameHandle, TetrisGameProps>(
  function TetrisGame({ onStateChange, onGameOver, initialTheme }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nextCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<TetrisEngine | null>(null);
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
      setTheme(theme: ThemeId) {
        engineRef.current?.setTheme(theme);
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      const nextCanvas = nextCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      const nextCtx = nextCanvas?.getContext("2d");
      if (!canvas || !nextCanvas || !ctx || !nextCtx) return;

      const engine = new TetrisEngine(
        ctx,
        nextCtx,
        (state) => {
          phaseRef.current = state.phase;
          onStateChangeRef.current(state);
          if (
            state.phase === "gameover" &&
            prevPhaseRef.current !== "gameover"
          ) {
            onGameOverRef.current(state.score);
          }
          prevPhaseRef.current = state.phase;
        },
        initialTheme,
      );
      engineRef.current = engine;

      let rafId: number;
      let lastTime: number | null = null;

      const loop = (ts: number) => {
        const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
        lastTime = ts;
        engine.update(dt);
        engine.draw();
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);

      // Listeners de movimiento activos solo en fase jugable y sin pausa; KeyP
      // no se maneja aquí — GamePlayer.tsx lo captura y reusa el mismo
      // togglePause() del botón PAUSA para mantener label/overlay sincronizados.
      const isActive = () =>
        !pausedRef.current && phaseRef.current === "playing";

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
          }}
        />
        <canvas
          ref={nextCanvasRef}
          width={NEXT_CANVAS_W}
          height={NEXT_CANVAS_H}
          style={{ position: "absolute", top: 12, right: 12, width: 90, height: 90 }}
        />
      </>
    );
  },
);

export default TetrisGame;
