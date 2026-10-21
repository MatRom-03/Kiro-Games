import { defineConfig } from "vite";

/**
 * Configuration Vite du frontend Halloween Ghost Dash.
 * - `server.port` : port du serveur de développement.
 * - `build.outDir` : dossier `dist` servi par Nginx en production.
 * - `test` : configuration Vitest (environnement Node, globals activés).
 */
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.js", "src/**/*.test.js"],
  },
});
