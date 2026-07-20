"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { SnakeEngine, CANVAS_W, CANVAS_H, type SnakeState, type Phase } from "./engine";

export interface SnakeGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}

export interface SnakeGameProps {
  onStateChange: (state: SnakeState) => void;
  onGameOver: (finalScore: number) => void;
}

const CONTROL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const SnakeGame = forwardRef<SnakeGameHandle, SnakeGameProps>(
  function SnakeGame({ onStateChange, onGameOver }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SnakeEngine | null>(null);
    const phaseRef = useRef<Phase>("playing");
    const pausedRef = useRef(false);
    const prevPhaseRef = useRef<Phase>("playing");
    const onStateChangeRef = useRef(onStateChange);
    const onGameOverRef = useRef(onGameOver);
    const [loaded, setLoaded] = useState(false);

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

      let cancelled = false;
      const engine = new SnakeEngine(ctx, (state) => {
        phaseRef.current = state.phase;
        onStateChangeRef.current(state);
        if (
          state.phase === "gameover" &&
          prevPhaseRef.current !== "gameover"
        ) {
          onGameOverRef.current(state.score);
        }
        prevPhaseRef.current = state.phase;
      });
      engineRef.current = engine;

      // Input discreto: cada flecha cambia nextDirection una vez por tecla,
      // no hay handleKeyUp que gestionar (mismo eje de clasificación que Tetris).
      const isActive = () =>
        !pausedRef.current && phaseRef.current === "playing";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!CONTROL_KEYS.has(e.code) || !isActive()) return;
        e.preventDefault();
        engine.handleKeyDown(e.code);
      };
      window.addEventListener("keydown", handleKeyDown);

      let rafId = 0;
      let lastTime: number | null = null;
      const loop = (ts: number) => {
        const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
        lastTime = ts;
        engine.update(dt);
        engine.draw();
        rafId = requestAnimationFrame(loop);
      };

      engine.load().then(() => {
        if (cancelled) return;
        setLoaded(true);
        rafId = requestAnimationFrame(loop);
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        window.removeEventListener("keydown", handleKeyDown);
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    return (
      <>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {!loaded && <div className="crt-content">CARGANDO...</div>}
      </>
    );
  },
);

export default SnakeGame;
