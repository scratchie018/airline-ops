import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} - copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  // One shared Discord application for every airline on the platform - each
  // airline is just a different guild this bot has been invited into, not a
  // separate set of Discord credentials.
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordClientSecret: required("DISCORD_CLIENT_SECRET"),
  discordRedirectUri: required("DISCORD_REDIRECT_URI"),
  discordBotToken: required("DISCORD_BOT_TOKEN"),
  // Optional now that Role is per-airline (Membership), not global on User -
  // used exactly once, to fix up the placeholder guild ID the multi-airline
  // migration leaves on the pre-existing default airline (see that migration's
  // SQL and index.ts). Safe to remove from the environment after that airline's
  // real guild ID has been set once, whether by this or by editing it in-app.
  discordGuildId: process.env.DISCORD_GUILD_ID || "",
  jwtSecret: required("JWT_SECRET"),
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:5173",
  port: Number(process.env.PORT) || 4000,
};
