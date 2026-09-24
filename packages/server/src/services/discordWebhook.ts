/** Only a genuine Discord webhook URL is ever accepted or posted to - this
 * field drives a server-side outbound request, so a loose "any URL" field here
 * would be an SSRF vector (someone could point it at an internal service or a
 * cloud metadata endpoint and have this server make the request for them). */
const DISCORD_WEBHOOK_PATTERN = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isValidDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_PATTERN.test(url);
}

/** Fire-and-forget announcement post - never throws into the caller, since a
 * flight update succeeding shouldn't depend on Discord being reachable. Errors
 * are only logged. */
export function postAirlineWebhook(webhookUrl: string, content: string): void {
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  }).catch((err) => console.error("Discord webhook post failed:", err));
}
