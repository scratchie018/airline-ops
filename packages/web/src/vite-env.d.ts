/// <reference types="vite/client" />

/** The full git commit SHA this build was compiled from - injected at build
 * time by vite.config.ts, not a runtime env var. */
declare const __COMMIT_SHA__: string;
