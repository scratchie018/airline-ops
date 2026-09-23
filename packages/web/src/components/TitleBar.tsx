import { useEffect, useState } from "react";
import { isElectron } from "../api";

/** Custom in-app titlebar for the desktop build - main.ts creates the window with
 * frame:false (no native title bar/menu bar), so this replaces it entirely: the
 * bar itself is a drag handle (-webkit-app-region: drag) and the three buttons on
 * the right call back into the main process over IPC to actually minimize/
 * maximize/close, since none of that comes for free without native window chrome.
 * Renders nothing in the browser build - a real browser tab already has this. */
export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI!.window.isMaximized().then(setIsMaximized);
    window.electronAPI!.window.onStateChanged(setIsMaximized);
  }, []);

  if (!isElectron) return null;

  return (
    <div
      className="h-9 flex items-center justify-between bg-[#0a0b1a] select-none flex-shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 px-3 text-ink-muted text-xs font-medium">
        <img src="icon.png" alt="" className="w-4 h-4 rounded" />
        Airline Ops
      </div>
      <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={() => window.electronAPI!.window.minimize()}
          className="w-11 h-full flex items-center justify-center text-ink-muted hover:bg-outline/10 hover:text-ink transition-colors"
          title="Minimize"
        >
          <i className="fa-regular fa-window-minimize text-[11px]" />
        </button>
        <button
          onClick={() => window.electronAPI!.window.maximizeToggle()}
          className="w-11 h-full flex items-center justify-center text-ink-muted hover:bg-outline/10 hover:text-ink transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <i className={`fa-regular ${isMaximized ? "fa-window-restore" : "fa-square"} text-[11px]`} />
        </button>
        <button
          onClick={() => window.electronAPI!.window.close()}
          className="w-11 h-full flex items-center justify-center text-ink-muted hover:bg-tuired-600 hover:text-white transition-colors"
          title="Close"
        >
          <i className="fa-solid fa-xmark text-[13px]" />
        </button>
      </div>
    </div>
  );
}
