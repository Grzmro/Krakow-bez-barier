import { existsSync, writeFileSync } from "node:fs";
import type { CapacitorConfig } from "@capacitor/cli";

// The shell loads the running web app (it has route handlers, so there is no static export).
// The URL is baked into the native project at `cap sync` time — rerun sync after changing it.
// Precedence: shell env > .env > .env.example (the simulator default).
for (const file of [".env", ".env.example"]) if (existsSync(file)) process.loadEnvFile(file);

const serverUrl = process.env.CAP_SERVER_URL;
if (!serverUrl) throw new Error("CAP_SERVER_URL is not set — see apps/mobile/.env.example");

// The offline page's "retry" button needs the URL too; written next to it, gitignored.
writeFileSync("www/server-url.js", `window.KBB_SERVER_URL = ${JSON.stringify(serverUrl)};\n`);

const config: CapacitorConfig = {
  appId: "pl.krakow.bezbarier",
  appName: "Kraków bez barier",
  // Bundled fallback only: error.html is shown when the server can't be reached.
  webDir: "www",
  server: {
    url: serverUrl,
    errorPath: "error.html",
    // Android only; on iOS, ATS in Info.plist allows HTTP only for local networks and IP addresses.
    cleartext: isLocalHttp(serverUrl),
  },
};

function isLocalHttp(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  if (protocol !== "http:") return false;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname)
  );
}

export default config;
