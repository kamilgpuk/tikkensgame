import express from "express";
import compression from "compression";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./api/routes.js";
import { setupWebSocket } from "./ws/handler.js";
import { startTickLoop } from "./game/session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = path.join(__dirname, "public");

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

// API
app.use("/api", router);

// Landing page at /
const LANDING = path.join(__dirname, "landing.html");
app.get("/", (_req, res) => res.sendFile(LANDING));

// Vite-hashed assets: immutable, 1-year cache (safe because filenames change on rebuild)
app.use(
  "/play/assets",
  express.static(path.join(CLIENT_DIST, "assets"), {
    maxAge: "1y",
    immutable: true,
  })
);

// React game app at /play (and all sub-paths) — no-cache on index.html so Cloudflare revalidates
app.use("/play", express.static(CLIENT_DIST, { maxAge: 0 }));
app.get("/play*", (_req, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));

// Static assets (JS/CSS chunks from Vite build)
app.use(express.static(CLIENT_DIST));

const server = http.createServer(app);
setupWebSocket(server);
startTickLoop();

server.listen(PORT, () => {
  console.log(`t'kkens running on http://localhost:${PORT}`);
});

// MCP server runs as a separate process — see server/src/mcp/index.ts
