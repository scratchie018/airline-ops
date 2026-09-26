import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Render sets this to the exact commit it's building from; falling back to a
// real `git rev-parse` covers local builds where that env var isn't set. This
// is how the running site can show "built from commit X" and let anyone
// check that commit's diff against the public repo themselves - see the
// footer in Layout.tsx/Login.tsx and PRIVACY.md's "Verifying this" section.
function resolveCommitSha(): string {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  define: {
    __COMMIT_SHA__: JSON.stringify(resolveCommitSha()),
  },
  // Absolute - required since this gets loaded at arbitrary nested paths (e.g.
  // /auth/callback after the OAuth redirect), where a relative base resolves
  // assets against the WRONG directory (a page at /auth/callback requesting
  // "./assets/x.js" fetches /auth/assets/x.js, a 404 - the script never loads,
  // the page is just blank). The desktop app loads this exact same build over
  // https now too (see packages/desktop/src/main.ts), not a local file:// copy,
  // so there's no second base path to account for anymore.
  base: "/",
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
