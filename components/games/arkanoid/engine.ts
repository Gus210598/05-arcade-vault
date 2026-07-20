// Motor de Arkanoid portado de references/started-games/04-arkanoid/game.js
// y levels.js a TypeScript, sin dependencias del DOM salvo el
// CanvasRenderingContext2D recibido y los assets cargados vía spritesheet.js.

import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  drawFrame,
  drawSprite,
  loadSpritesheet,
} from "./assets/spritesheet";
import bounceSoundSrc from "./assets/sounds/ball-bounce.mp3";
import breakSoundSrc from "./assets/sounds/break-sound.mp3";

export type Phase = "playing" | "gameover";

export interface ArkanoidState {
  score: number;
  lives: number;
  level: number;
  phase: Phase;
  won: boolean;
}

export const CANVAS_W = 800;
export const CANVAS_H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (CANVAS_W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const PAUSE_BTN_W = 60;
const PAUSE_BTN_H = 40;
const PAUSE_BTN_GAP = 12;
const PAUSE_BTN_Y = 340;
const PAUSE_BTN_ROW_X = (CANVAS_W - (5 * PAUSE_BTN_W + 4 * PAUSE_BTN_GAP)) / 2;

type BlockColor =
  | "red"
  | "yellow"
  | "cyan"
  | "magenta"
  | "hotpink"
  | "green"
  | "gray";

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

interface LevelBlock {
  col: number;
  row: number;
  color: BlockColor;
}

interface Level {
  blocks: LevelBlock[];
  ballSpeedMultiplier: number;
}

// LEVELS portado literal de levels.js (5 niveles fijos, patrones de bloques
// y multiplicador de velocidad de bola por nivel).
export const LEVELS: Level[] = (() => {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({
          col,
          row,
          color: isCross && !isFrame ? "hotpink" : "cyan",
        });
    }

  return [
    { ballSpeedMultiplier: 1.0, blocks: l1 },
    { ballSpeedMultiplier: 1.1, blocks: l2 },
    { ballSpeedMultiplier: 1.21, blocks: l3 },
    { ballSpeedMultiplier: 1.33, blocks: l4 },
    { ballSpeedMultiplier: 1.46, blocks: l5 },
  ];
})();

export class ArkanoidEngine {
  private ctx: CanvasRenderingContext2D;
  private onStateChange: (state: ArkanoidState) => void;

  private paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  private ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private lives = 3;
  private score = 0;
  private currentLevel = 1;
  private phase: Phase = "playing";
  private won = false;
  private isPaused = false;
  private keys = { ArrowLeft: false, ArrowRight: false };
  private lastNotified: ArkanoidState | null = null;

  private bounceSound: HTMLAudioElement;
  private breakSound: HTMLAudioElement;
  private onPauseChange?: (paused: boolean) => void;

  constructor(
    ctx: CanvasRenderingContext2D,
    onStateChange: (state: ArkanoidState) => void,
    onPauseChange?: (paused: boolean) => void,
  ) {
    this.ctx = ctx;
    this.onStateChange = onStateChange;
    this.onPauseChange = onPauseChange;
    this.bounceSound = new Audio(bounceSoundSrc);
    this.breakSound = new Audio(breakSoundSrc);
    this.restart();
  }

  // El menú de salto de nivel en pausa despausa el motor directamente (igual
  // que el original), sin pasar por pause()/resume(); este callback avisa a
  // quien monta el componente (GamePlayer.tsx) para que su propio estado de
  // "paused" no quede desincronizado del engine real en ese camino.
  private setPaused(value: boolean) {
    if (this.isPaused === value) return;
    this.isPaused = value;
    this.onPauseChange?.(value);
  }

  load(): Promise<void> {
    return new Promise((resolve) => {
      loadSpritesheet(() => resolve());
    });
  }

  private initPaddle() {
    this.paddle.x = (CANVAS_W - this.paddle.w) / 2;
  }

  private resetBall(speedMultiplier: number) {
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speedMultiplier;
    this.ball.vy = BASE_BALL_VY * speedMultiplier;
  }

  private loadLevel(n: number) {
    this.currentLevel = n;
    const level = LEVELS[n - 1];
    this.blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.resetBall(level.ballSpeedMultiplier);
  }

  private collideAABB(block: Block): boolean {
    return (
      this.ball.x < block.x + block.w &&
      this.ball.x + this.ball.w > block.x &&
      this.ball.y < block.y + block.h &&
      this.ball.y + this.ball.h > block.y
    );
  }

  private playBounce() {
    const clone = this.bounceSound.cloneNode() as HTMLAudioElement;
    void clone.play();
  }

  private playBreak() {
    const clone = this.breakSound.cloneNode() as HTMLAudioElement;
    void clone.play();
  }

  private notify() {
    const state: ArkanoidState = {
      score: this.score,
      lives: this.lives,
      level: this.currentLevel,
      phase: this.phase,
      won: this.won,
    };
    const prev = this.lastNotified;
    if (
      !prev ||
      prev.score !== state.score ||
      prev.lives !== state.lives ||
      prev.level !== state.level ||
      prev.phase !== state.phase ||
      prev.won !== state.won
    ) {
      this.lastNotified = state;
      this.onStateChange(state);
    }
  }

  handleKeyDown(code: string) {
    if (code === "ArrowLeft") this.keys.ArrowLeft = true;
    if (code === "ArrowRight") this.keys.ArrowRight = true;
    if ((code === "KeyP" || code === "Escape") && this.phase === "playing") {
      this.setPaused(!this.isPaused);
    }
  }

  handleKeyUp(code: string) {
    if (code === "ArrowLeft") this.keys.ArrowLeft = false;
    if (code === "ArrowRight") this.keys.ArrowRight = false;
  }

  handleMouseMove(canvasX: number, canvasY: number) {
    void canvasY; // mousemove del original solo usa clientX, ver Convenciones del spec
    this.paddle.x = Math.max(
      0,
      Math.min(CANVAS_W - this.paddle.w, canvasX - this.paddle.w / 2),
    );
  }

  handleClick(canvasX: number, canvasY: number) {
    if (!this.isPaused) return;
    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      if (
        canvasX >= bx &&
        canvasX <= bx + PAUSE_BTN_W &&
        canvasY >= PAUSE_BTN_Y &&
        canvasY <= PAUSE_BTN_Y + PAUSE_BTN_H
      ) {
        this.loadLevel(i + 1);
        this.setPaused(false);
        this.notify();
        return;
      }
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  forceGameOver() {
    this.phase = "gameover";
    this.won = false;
    this.notify();
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.phase = "playing";
    this.won = false;
    this.isPaused = false;
    this.keys = { ArrowLeft: false, ArrowRight: false };
    this.initPaddle();
    this.loadLevel(1);
    this.notify();
  }

  destroy() {
    // sin recursos externos que liberar — el rAF y los listeners los gestiona
    // el componente; los Audio no requieren cleanup explícito.
  }

  update(dt: number) {
    if (this.isPaused || this.phase !== "playing") return;

    if (this.keys.ArrowLeft)
      this.paddle.x = Math.max(0, this.paddle.x - PADDLE_SPEED * dt);
    if (this.keys.ArrowRight)
      this.paddle.x = Math.min(
        CANVAS_W - this.paddle.w,
        this.paddle.x + PADDLE_SPEED * dt,
      );

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ball.vx = Math.abs(this.ball.vx);
      this.playBounce();
    }
    if (this.ball.x + this.ball.w >= CANVAS_W) {
      this.ball.x = CANVAS_W - this.ball.w;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.playBounce();
    }
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ball.vy = Math.abs(this.ball.vy);
      this.playBounce();
    }

    if (
      this.ball.vy > 0 &&
      this.ball.x + this.ball.w > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.w &&
      this.ball.y + this.ball.h >= this.paddle.y &&
      this.ball.y + this.ball.h <= this.paddle.y + this.paddle.h + 8
    ) {
      this.ball.y = this.paddle.y - this.ball.h;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.playBounce();
    }

    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += 10;
        this.ball.vy = -this.ball.vy;
        this.playBreak();
        if (this.blocks.every((b) => !b.alive)) {
          if (this.currentLevel < 5) {
            this.loadLevel(this.currentLevel + 1);
          } else {
            this.phase = "gameover";
            this.won = true;
          }
        }
        break; // un bloque por frame, igual que el original
      }
    }

    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION,
    );

    if (this.ball.y > CANVAS_H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.phase = "gameover";
        this.won = false;
      } else {
        this.resetBall(LEVELS[this.currentLevel - 1].ballSpeedMultiplier);
      }
    }

    this.notify();
  }

  private drawOverlay(message: string) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, CANVAS_W / 2, CANVAS_H / 2);
  }

  private drawPauseOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSA", CANVAS_W / 2, 260);

    ctx.font = "bold 16px monospace";
    ctx.fillText("Saltar al nivel:", CANVAS_W / 2, 310);

    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      const isActive = i + 1 === this.currentLevel;
      ctx.fillStyle = isActive ? "#f0c040" : "#444";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isActive ? "#000" : "#fff";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        String(i + 1),
        bx + PAUSE_BTN_W / 2,
        PAUSE_BTN_Y + PAUSE_BTN_H / 2,
      );
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const block of this.blocks) {
      if (block.alive)
        drawSprite(ctx, "block_" + block.color, block.x, block.y, block.w, block.h);
    }

    for (const exp of this.explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        ctx,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    drawSprite(ctx, "paddle", this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    drawSprite(ctx, "ball", this.ball.x, this.ball.y, this.ball.w, this.ball.h);

    if (this.phase === "playing") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("Score: " + this.score, 10, 10);
      ctx.textAlign = "center";
      ctx.fillText("Nivel: " + this.currentLevel, CANVAS_W / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < this.lives; i++) {
        const bx = CANVAS_W - 10 - (this.lives - i) * (ballSize + ballSpacing);
        drawSprite(ctx, "ball", bx, 10, ballSize, ballSize);
      }
    }

    if (this.phase === "gameover") {
      this.drawOverlay(this.won ? "¡COMPLETASTE EL JUEGO!" : "GAME OVER");
    }
    if (this.isPaused) this.drawPauseOverlay();
  }
}
