import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Electron loads the built files via file://, so asset URLs must be relative.
  base: "./",
  resolve: {
    alias: {
      // Point straight at shared's TypeScript source instead of its compiled CJS
      // dist - the compiled output's re-export getters (tsc's CJS codegen) trip up
      // Rollup's static CJS->ESM interop tracing. Going through esbuild's native TS
      // handling on the real source sidesteps that entirely, and shared has no
      // build step to keep in sync this way during web development.
      shared: path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
});
