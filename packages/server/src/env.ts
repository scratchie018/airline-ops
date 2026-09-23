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
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordClientSecret: required("DISCORD_CLIENT_SECRET"),
  discordRedirectUri: required("DISCORD_REDIRECT_URI"),
  discordBotToken: required("DISCORD_BOT_TOKEN"),
  discordGuildId: required("DISCORD_GUILD_ID"),
  discordRoleIds: {
    OWNER: process.env.DISCORD_ROLE_ID_OWNER || "",
    MANAGER: process.env.DISCORD_ROLE_ID_MANAGER || "",
    FLIGHT_HOST: process.env.DISCORD_ROLE_ID_FLIGHT_HOST || "",
    PILOT: process.env.DISCORD_ROLE_ID_PILOT || "",
  },
  jwtSecret: required("JWT_SECRET"),
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:5173",
  desktopRedirectOrigin: process.env.DESKTOP_REDIRECT_ORIGIN || "http://localhost:4100",
  port: Number(process.env.PORT) || 4000,
};
