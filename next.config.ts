import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Turbopack no trae manejo nativo para .mp3 (sí para imágenes/fuentes);
    // "asset" hace que el import resuelva a la URL del archivo, igual que
    // webpack's asset/resource. Lo usa components/games/arkanoid/engine.ts
    // para cargar los efectos de sonido del juego.
    rules: {
      "*.mp3": {
        type: "asset",
      },
    },
  },
};

export default nextConfig;
