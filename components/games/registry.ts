"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada juego tiene props/ref distintos; este mapa es solo un lookup por id, no se renderiza con props tipados aquí
export const engineRegistry: Record<string, ComponentType<any>> = {
  asteroides: dynamic(() => import("@/components/games/asteroids/AsteroidsGame")),
  tetris: dynamic(() => import("@/components/games/tetris/TetrisGame")),
  arkanoid: dynamic(() => import("@/components/games/arkanoid/ArkanoidGame")),
};
