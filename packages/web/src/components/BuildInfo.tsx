import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../api";

const REPO_URL = "https://github.com/scratchie018/airline-ops";

function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

/** Proof-of-provenance footer: links the exact commit this build was compiled
 * from (baked in at build time, see vite.config.ts) straight to that commit
 * on the public repo, so anyone can confirm the running site matches
 * published source rather than just trusting that it does. Also fetches the
 * API's own build commit from /health, since the website and API deploy
 * separately on Render and could in principle drift. */
export default function BuildInfo() {
  const [apiCommit, setApiCommit] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((d) => setApiCommit(typeof d.commit === "string" ? d.commit : null))
      .catch(() => {});
  }, []);

  return (
    <p className="text-xs text-ink-muted">
      Web{" "}
      <a
        href={`${REPO_URL}/commit/${__COMMIT_SHA__}`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-ink hover:underline font-mono"
      >
        {shortSha(__COMMIT_SHA__)}
      </a>
      {apiCommit && apiCommit !== "dev" && (
        <>
          {" "}
          · API{" "}
          <a
            href={`${REPO_URL}/commit/${apiCommit}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink hover:underline font-mono"
          >
            {shortSha(apiCommit)}
          </a>
        </>
      )}{" "}
      ·{" "}
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
        Source
      </a>{" "}
      · <Link to="/privacy" className="hover:text-ink hover:underline">Privacy</Link>
    </p>
  );
}
