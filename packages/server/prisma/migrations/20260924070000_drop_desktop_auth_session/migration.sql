-- The desktop app no longer runs its own OAuth polling flow - it's just the
-- real website loaded in an Electron window now, using the exact same
-- token-in-URL redirect a browser tab gets. This table only ever held
-- short-lived (5 minute TTL), disposable session handoffs, never anything
-- worth preserving.
DROP TABLE "DesktopAuthSession";
