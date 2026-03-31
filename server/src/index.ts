import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { router } from "./api/routes.js";
import { setupWebSocket } from "./ws/handler.js";
import { startTickLoop } from "./game/session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = path.join(__dirname, "../../client/dist");

const app = express();
app.use(cors());
app.use(express.json());

// API
app.use("/api", router);

// Serve client in production
app.use(express.static(CLIENT_DIST));
app.get("*", (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

const server = http.createServer(app);
setupWebSocket(server);
startTickLoop();

server.listen(PORT, () => {
  console.log(`AI Hype Machine running on http://localhost:${PORT}`);
});

// MCP server runs as a separate process — see server/src/mcp/index.ts
