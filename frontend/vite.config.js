import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.resolve(here, "../.offmail_token");

// The backend writes a random per-install token to <repo>/.offmail_token.
// The dev proxy adds it to every /api request, so the browser (and any page
// running in it) never sees the token. Read per request: the file may not
// exist yet when Vite starts, because the backend creates it on first run.
function readToken() {
  try {
    return fs.readFileSync(TOKEN_PATH, "utf8").trim();
  } catch {
    return process.env.OFFMAIL_TOKEN || "";
  }
}

// Vite config — proxy /api → backend on port 8000 (localhost only)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const token = readToken();
            if (token) proxyReq.setHeader("X-Offmail-Token", token);
          });
        },
      },
    },
  },
});
