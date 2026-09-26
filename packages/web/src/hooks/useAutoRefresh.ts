import { useEffect, useRef } from "react";

const AUTO_REFRESH_MS = 30000;

/** Re-runs `callback` every 30s for as long as the calling component stays
 * mounted, so every client looking at the same data converges on whatever
 * any other client just changed within half a minute, without anyone
 * needing to manually refresh. Doesn't call it immediately - callers already
 * have their own mount-time initial load, this only adds the recurring tick
 * on top of it, at one shared cadence across the whole app.
 *
 * Takes the callback via a ref rather than a dependency array so the
 * interval is set up once and never torn down/recreated on every render,
 * while still always invoking whatever closure (state, props) is current as
 * of the calling component's latest render. */
export function useAutoRefresh(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const interval = setInterval(() => callbackRef.current(), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);
}
