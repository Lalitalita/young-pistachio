/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Vieux téléphones : cible large, pas de syntaxe trop récente.
  build: { target: "es2019", cssTarget: "chrome61" },
  server: {
    proxy: {
      "/api": { target: "http://localhost:8000", ws: true },
    },
  },
  test: { environment: "node" },
});
