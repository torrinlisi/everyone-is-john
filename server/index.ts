import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { setupSocketHandlers } from "./rooms.js";
import { goalsRouter, skillsRouter, roomRouter } from "./rooms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use("/api/goals", goalsRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/room", roomRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

setupSocketHandlers(io);

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "..", "..", "client", "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
