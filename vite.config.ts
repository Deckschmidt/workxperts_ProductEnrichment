import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Lovable-kompatible Vite-Konfiguration (eine package.json im Root).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 8080,
  },
});
