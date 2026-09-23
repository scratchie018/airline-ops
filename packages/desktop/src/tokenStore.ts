import { app, safeStorage } from "electron";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tokenPath = () => join(app.getPath("userData"), "session.token");

/** Encrypts the session JWT at rest using the OS keychain/DPAPI/libsecret via
 * Electron's safeStorage, instead of writing the raw token to disk. Falls back to
 * plaintext only on the rare setup where OS-level encryption isn't available
 * (e.g. some headless Linux configs with no secret service running). */
export function saveToken(token: string): void {
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(token) : Buffer.from(token, "utf8");
  writeFileSync(tokenPath(), data);
}

export function loadToken(): string | null {
  const path = tokenPath();
  if (!existsSync(path)) return null;
  const data = readFileSync(path);
  try {
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : data.toString("utf8");
  } catch {
    return null;
  }
}

export function clearToken(): void {
  const path = tokenPath();
  if (existsSync(path)) unlinkSync(path);
}
