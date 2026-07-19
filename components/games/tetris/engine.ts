// Motor de Tetris portado de references/started-games/03-tetris/game.js
// a TypeScript, sin dependencias del DOM salvo los CanvasRenderingContext2D recibidos.

export type Phase = "playing" | "gameover";

export interface TetrisState {
  score: number;
  lines: number;
  level: number;
  phase: Phase;
}

export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const CANVAS_W = COLS * BLOCK;
export const CANVAS_H = ROWS * BLOCK;
export const NEXT_BLOCK = 30;
export const NEXT_CANVAS_W = 120;
export const NEXT_CANVAS_H = 120;

// --bg del sitio (duplicado aquí porque canvas no resuelve var(--x) en fillStyle).
const BG = "#0a0a0f";
const GRID_LINE = "#22222e";

type Shape = number[][];

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

const PIECES: (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

export type ThemeId = "retro" | "neon" | "pixel-art";

export type BlockStyle = "flat-highlight" | "soft-glow" | "pixel-outline";

export interface TetrisTheme {
  id: ThemeId;
  label: string;
  colors: [string, string, string, string, string, string, string]; // índices 1–7: I,O,T,S,Z,J,L
  blockStyle: BlockStyle;
}

export const THEMES: Record<ThemeId, TetrisTheme> = {
  retro: {
    id: "retro",
    label: "RETRO",
    colors: [
      "#4dd0e1",
      "#ffd54f",
      "#ba68c8",
      "#81c784",
      "#e57373",
      "#90caf9",
      "#ffb74d",
    ],
    blockStyle: "flat-highlight",
  },
  neon: {
    id: "neon",
    label: "NEÓN",
    colors: [
      "#00f5ff",
      "#f5ff00",
      "#ff006e",
      "#00ff88",
      "#ff3860",
      "#4d7fff",
      "#ff9100",
    ],
    blockStyle: "soft-glow",
  },
  "pixel-art": {
    id: "pixel-art",
    label: "PIXEL ART",
    colors: [
      "#00e5ff",
      "#ffee00",
      "#d500f9",
      "#00e676",
      "#ff1744",
      "#2979ff",
      "#ff9100",
    ],
    blockStyle: "pixel-outline",
  },
};

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

export class TetrisEngine {
  private ctx: CanvasRenderingContext2D;
  private nextCtx: CanvasRenderingContext2D;
  private onStateChange: (state: TetrisState) => void;

  private board: number[][] = createBoard();
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private phase: Phase = "playing";
  private paused = false;
  private dropAccum = 0;
  private dropInterval = 1000;
  private activeTheme: TetrisTheme = THEMES.retro;
  private lastNotified: TetrisState | null = null;

  constructor(
    ctx: CanvasRenderingContext2D,
    nextCtx: CanvasRenderingContext2D,
    onStateChange: (state: TetrisState) => void,
    initialTheme?: ThemeId,
  ) {
    this.ctx = ctx;
    this.nextCtx = nextCtx;
    this.onStateChange = onStateChange;
    this.setTheme(initialTheme ?? "retro");
    this.restart();
  }

  private randomPiece(): Piece {
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  private collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private tryRotate() {
    const rotated = rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private merge() {
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.board[this.current.y + r][this.current.x + c] =
            this.current.shape[r][c];
  }

  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private hardDrop() {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  private softDrop() {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private spawn() {
    this.current = this.next;
    this.next = this.randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.phase = "gameover";
    }
  }

  private notify() {
    const state: TetrisState = {
      score: this.score,
      lines: this.lines,
      level: this.level,
      phase: this.phase,
    };
    const prev = this.lastNotified;
    if (
      !prev ||
      prev.score !== state.score ||
      prev.lines !== state.lines ||
      prev.level !== state.level ||
      prev.phase !== state.phase
    ) {
      this.lastNotified = state;
      this.onStateChange(state);
    }
  }

  // "KeyP" también resuelve aquí para fidelidad del contrato del engine;
  // el toggle de pausa en vivo lo dispara GamePlayer.tsx llamando pause()/resume()
  // directamente (ver Decisions de la implementación), no este atajo.
  handleKeyDown(code: string) {
    if (code === "KeyP") {
      if (this.phase === "gameover") return;
      this.paused = !this.paused;
      return;
    }
    if (this.paused || this.phase === "gameover") return;
    switch (code) {
      case "ArrowLeft":
        if (
          !this.collide(this.current.shape, this.current.x - 1, this.current.y)
        )
          this.current.x--;
        break;
      case "ArrowRight":
        if (
          !this.collide(this.current.shape, this.current.x + 1, this.current.y)
        )
          this.current.x++;
        break;
      case "ArrowDown":
        this.softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        this.tryRotate();
        break;
      case "Space":
        this.hardDrop();
        break;
      default:
        return;
    }
    this.notify();
  }

  handleKeyUp(code: string) {
    // no-op — Tetris no tiene input "mantenido", cada acción se resuelve en handleKeyDown
    void code;
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
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.phase = "playing";
    this.paused = false;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.next = this.randomPiece();
    this.spawn();
    this.notify();
  }

  setTheme(theme: ThemeId) {
    this.activeTheme = THEMES[theme];
    const smoothing = this.activeTheme.blockStyle !== "pixel-outline";
    this.ctx.imageSmoothingEnabled = smoothing;
    this.nextCtx.imageSmoothingEnabled = smoothing;
  }

  destroy() {
    // sin recursos externos que liberar — el rAF y los listeners los gestiona el componente
  }

  update(dt: number) {
    if (this.paused || this.phase === "gameover") return;
    this.dropAccum += dt;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (
        !this.collide(this.current.shape, this.current.x, this.current.y + 1)
      ) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
    this.notify();
  }

  private drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    const color = this.activeTheme.colors[colorIndex - 1];
    switch (this.activeTheme.blockStyle) {
      case "flat-highlight":
        this.drawFlatHighlight(context, x, y, color, size, alpha);
        break;
      case "soft-glow":
        this.drawSoftGlow(context, x, y, color, size, alpha);
        break;
      case "pixel-outline":
        this.drawPixelOutline(context, x, y, color, size, alpha);
        break;
    }
  }

  private drawFlatHighlight(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    size: number,
    alpha: number,
  ) {
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  private drawSoftGlow(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    size: number,
    alpha: number,
  ) {
    context.save();
    context.globalAlpha = alpha;
    context.shadowColor = color;
    context.shadowBlur = 12;
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x * size + 2, y * size + 2, size - 4, size - 4, 4);
    context.fill();
    context.restore();
  }

  private drawPixelOutline(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    size: number,
    alpha: number,
  ) {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
    context.strokeStyle = "rgba(0,0,0,0.6)";
    context.lineWidth = 2;
    context.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.5)";
    context.fillRect(x * size + 3, y * size + 3, 4, 4);
    context.restore();
  }

  private drawGrid(
    context: CanvasRenderingContext2D,
    cols: number,
    rows: number,
    size: number,
  ) {
    context.strokeStyle = GRID_LINE;
    context.lineWidth = 0.5;
    for (let c = 1; c < cols; c++) {
      context.beginPath();
      context.moveTo(c * size, 0);
      context.lineTo(c * size, rows * size);
      context.stroke();
    }
    for (let r = 1; r < rows; r++) {
      context.beginPath();
      context.moveTo(0, r * size);
      context.lineTo(cols * size, r * size);
      context.stroke();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    this.drawGrid(ctx, COLS, ROWS, BLOCK);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(ctx, c, r, this.board[r][c], BLOCK);

    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            ctx,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            BLOCK,
            0.2,
          );

    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        this.drawBlock(
          ctx,
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          BLOCK,
        );

    const nextCtx = this.nextCtx;
    nextCtx.fillStyle = BG;
    nextCtx.fillRect(0, 0, NEXT_CANVAS_W, NEXT_CANVAS_H);
    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
  }
}
