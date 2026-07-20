// Motor de Snake diseñado desde cero (no hay game.js de origen para Snake
// en references/started-games/, ver Decisions del spec). Cuerpo/cabeza con
// primitivas de canvas reskineadas en la paleta neón del sitio; la fruta usa
// el sprite real del atlas portado en assets/spriteAtlas.ts.

import { FRUIT_ATLAS, FRUIT_KEYS, FRUITS_IMAGE_SRC } from "./assets/spriteAtlas";

export type Phase = "playing" | "gameover";

export interface SnakeState {
  score: number;
  length: number;
  level: number;
  phase: Phase;
}

export const GRID = 20;
export const CELL = 30;
export const CANVAS_W = GRID * CELL;
export const CANVAS_H = GRID * CELL;

// --bg/--cyan/--magenta/--yellow/--green del sitio (duplicados aquí porque
// canvas no resuelve var(--x) en fillStyle, mismo criterio que Tetris/Arkanoid).
const BG = "#0a0a0f";
const GRID_LINE = "#15151f";
const HEAD_COLOR = "#00ff88";
const BODY_COLOR = "#00b368";
const ACCENT_COLORS = ["#00f5ff", "#ff006e", "#f5ff00"];

const INITIAL_INTERVAL_MS = 160;
const MIN_INTERVAL_MS = 60;
const FRUITS_PER_TIER = 5;
const SPEEDUP_FACTOR = 0.95;
const POINTS_PER_FRUIT = 10;

type Direction = "up" | "down" | "left" | "right";

interface GridCell {
  x: number;
  y: number;
}

interface Food {
  cell: GridCell;
  fruitKey: string;
}

const DIRECTION_VECTORS: Record<Direction, GridCell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export class SnakeEngine {
  private ctx: CanvasRenderingContext2D;
  private onStateChange: (state: SnakeState) => void;

  private segments: GridCell[] = [];
  private direction: Direction = "right";
  private nextDirection: Direction = "right";
  private food!: Food;
  private moveIntervalMs = INITIAL_INTERVAL_MS;
  private moveAccumMs = 0;
  private fruitsEaten = 0;
  private score = 0;
  private phase: Phase = "playing";
  private paused = false;
  private lastNotified: SnakeState | null = null;

  private fruitsImage: HTMLImageElement | null = null;

  constructor(
    ctx: CanvasRenderingContext2D,
    onStateChange: (state: SnakeState) => void,
  ) {
    this.ctx = ctx;
    this.onStateChange = onStateChange;
    this.restart();
  }

  // Se resuelve cuando fruits.png termina de cargar (Image.onload); si falla
  // la carga, el estado "CARGANDO..." queda indefinido, mismo riesgo ya
  // aceptado en Arkanoid (ver Risks del spec).
  load(): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.fruitsImage = img;
        resolve();
      };
      img.onerror = () => console.error("Failed to load fruits.png");
      img.src = FRUITS_IMAGE_SRC;
    });
  }

  private get level(): number {
    return 1 + Math.floor(this.fruitsEaten / FRUITS_PER_TIER);
  }

  private randomFreeCell(): GridCell {
    const free: GridCell[] = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (!this.segments.some((s) => s.x === x && s.y === y)) {
          free.push({ x, y });
        }
      }
    }
    return free[Math.floor(Math.random() * free.length)];
  }

  private spawnFood() {
    const cell = this.randomFreeCell();
    const fruitKey = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
    this.food = { cell, fruitKey };
  }

  private notify() {
    const state: SnakeState = {
      score: this.score,
      length: this.segments.length,
      level: this.level,
      phase: this.phase,
    };
    const prev = this.lastNotified;
    if (
      !prev ||
      prev.score !== state.score ||
      prev.length !== state.length ||
      prev.level !== state.level ||
      prev.phase !== state.phase
    ) {
      this.lastNotified = state;
      this.onStateChange(state);
    }
  }

  // Solo cambia nextDirection; el giro de 180° se bloquea contra la
  // dirección actual del engine, no contra la última tecla presionada
  // (ver Risks del spec — evita colisiones injustas por doble tecla rápida).
  handleKeyDown(code: string) {
    const dir = KEY_TO_DIRECTION[code];
    if (!dir || this.phase !== "playing") return;
    if (dir === OPPOSITE[this.direction]) return;
    this.nextDirection = dir;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  forceGameOver() {
    this.phase = "gameover";
    this.notify();
  }

  restart() {
    this.segments = [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ];
    this.direction = "right";
    this.nextDirection = "right";
    this.moveIntervalMs = INITIAL_INTERVAL_MS;
    this.moveAccumMs = 0;
    this.fruitsEaten = 0;
    this.score = 0;
    this.phase = "playing";
    this.paused = false;
    this.spawnFood();
    this.notify();
  }

  destroy() {
    // sin recursos externos que liberar — el rAF y los listeners los gestiona el componente
  }

  update(dt: number) {
    if (this.paused || this.phase !== "playing") return;
    this.moveAccumMs += dt;
    if (this.moveAccumMs < this.moveIntervalMs) return;
    this.moveAccumMs = 0;

    this.direction = this.nextDirection;
    const vec = DIRECTION_VECTORS[this.direction];
    const head = this.segments[0];
    const newHead: GridCell = { x: head.x + vec.x, y: head.y + vec.y };

    if (
      newHead.x < 0 ||
      newHead.x >= GRID ||
      newHead.y < 0 ||
      newHead.y >= GRID
    ) {
      this.phase = "gameover";
      this.notify();
      return;
    }

    const ateFood =
      newHead.x === this.food.cell.x && newHead.y === this.food.cell.y;
    // La cola actual se corre este tick salvo que se coma fruta (ver abajo),
    // así que no cuenta como colisión contra la celda que va a quedar libre.
    const bodyToCheck = ateFood
      ? this.segments
      : this.segments.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.phase = "gameover";
      this.notify();
      return;
    }

    this.segments.unshift(newHead);
    if (ateFood) {
      this.score += POINTS_PER_FRUIT;
      this.fruitsEaten++;
      this.moveIntervalMs = Math.max(
        MIN_INTERVAL_MS,
        Math.round(
          INITIAL_INTERVAL_MS * Math.pow(SPEEDUP_FACTOR, this.level - 1),
        ),
      );
      this.spawnFood();
    } else {
      this.segments.pop();
    }

    this.notify();
  }

  private drawFruit() {
    if (!this.fruitsImage) return;
    const rect = FRUIT_ATLAS[this.food.fruitKey];
    if (!rect) return;
    const scale = Math.min(CELL / rect.w, CELL / rect.h) * 0.9;
    const dw = rect.w * scale;
    const dh = rect.h * scale;
    const dx = this.food.cell.x * CELL + (CELL - dw) / 2;
    const dy = this.food.cell.y * CELL + (CELL - dh) / 2;
    this.ctx.drawImage(
      this.fruitsImage,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      dx,
      dy,
      dw,
      dh,
    );
  }

  private drawSnake() {
    const ctx = this.ctx;
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const isHead = i === 0;
      const px = seg.x * CELL;
      const py = seg.y * CELL;

      if (isHead) {
        ctx.save();
        ctx.shadowColor = HEAD_COLOR;
        ctx.shadowBlur = 10;
        ctx.fillStyle = HEAD_COLOR;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.restore();
      } else {
        const isAccent = i % 4 === 0;
        ctx.fillStyle = isAccent
          ? ACCENT_COLORS[(i / 4) % ACCENT_COLORS.length]
          : BODY_COLOR;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      }
    }
  }

  private drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < GRID; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, CANVAS_H);
      ctx.stroke();
    }
    for (let r = 1; r < GRID; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(CANVAS_W, r * CELL);
      ctx.stroke();
    }
  }

  private drawOverlay(message: string) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, CANVAS_W / 2, CANVAS_H / 2);
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.drawGrid();
    this.drawFruit();
    this.drawSnake();

    if (this.phase === "playing") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Score: " + this.score, 10, 10);
      ctx.textAlign = "right";
      ctx.fillText("Longitud: " + this.segments.length, CANVAS_W - 10, 10);
    }

    if (this.phase === "gameover") {
      this.drawOverlay("GAME OVER");
    }
    if (this.paused && this.phase === "playing") {
      this.drawOverlay("PAUSA");
    }
  }
}
