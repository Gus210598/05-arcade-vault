"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ArkanoidEngine,
  CANVAS_W,
  CANVAS_H,
  type ArkanoidState,
  type Phase,
} from "./engine";

export interface ArkanoidGameHandle {
  pause(): void;
  resume(): void;
  forceGameOver(): void;
  restart(): void;
}

export interface ArkanoidGameProps {
  onStateChange: (state: ArkanoidState) => void;
  onGameOver: (finalScore: number) => void;
  // El menú de salto de nivel en pausa despausa el motor por su cuenta (ver
  // Convenciones del spec); este callback opcional avisa cuando eso pasa,
  // para que quien monte el componente pueda mantener sincronizado su propio
  // botón PAUSA/REANUDAR. Tetris/Asteroids no lo necesitan y pueden omitirlo.
  onPauseChange?: (paused: boolean) => void;
}

const CONTROL_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

const ArkanoidGame = forwardRef<ArkanoidGameHandle, ArkanoidGameProps>(
  function ArkanoidGame({ onStateChange, onGameOver, onPauseChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ArkanoidEngine | null>(null);
    const phaseRef = useRef<Phase>("playing");
    const pausedRef = useRef(false);
    const prevPhaseRef = useRef<Phase>("playing");
    const onStateChangeRef = useRef(onStateChange);
    const onGameOverRef = useRef(onGameOver);
    const onPauseChangeRef = useRef(onPauseChange);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    useEffect(() => {
      onGameOverRef.current = onGameOver;
    }, [onGameOver]);

    useEffect(() => {
      onPauseChangeRef.current = onPauseChange;
    }, [onPauseChange]);

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
      const engine = new ArkanoidEngine(ctx, (state) => {
        phaseRef.current = state.phase;
        onStateChangeRef.current(state);
        if (
          state.phase === "gameover" &&
          prevPhaseRef.current !== "gameover"
        ) {
          onGameOverRef.current(state.score);
        }
        prevPhaseRef.current = state.phase;
      }, (paused) => {
        pausedRef.current = paused;
        onPauseChangeRef.current?.(paused);
      });
      engineRef.current = engine;

      // Coordenadas ya convertidas a espacio de canvas (800×600 interno);
      // el engine nunca toca getBoundingClientRect() (ver Convenciones del spec).
      const toCanvasCoords = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        };
      };
      const handleMouseMove = (e: MouseEvent) => {
        const { x, y } = toCanvasCoords(e);
        engine.handleMouseMove(x, y);
      };
      const handleClick = (e: MouseEvent) => {
        const { x, y } = toCanvasCoords(e);
        engine.handleClick(x, y);
      };
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("click", handleClick);

      // El movimiento por teclado solo se intercepta jugando y sin pausa;
      // P/Escape para pausar los captura GamePlayer.tsx reusando togglePause(),
      // mismo criterio que Tetris, para que el label PAUSA/REANUDAR nunca
      // quede desincronizado del engine real.
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

      let rafId = 0;
      let lastTime: number | null = null;
      const loop = (ts: number) => {
        const dt =
          lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
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
        window.removeEventListener("keyup", handleKeyUp);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("click", handleClick);
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

export default ArkanoidGame;
