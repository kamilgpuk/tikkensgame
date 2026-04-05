/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/play/",
  build: {
    outDir: "../server/dist/public",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@ai-hype/shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    resolve: {
      alias: {
        "@ai-hype/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      },
    },
  },
});
