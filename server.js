const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const {
  initRedis,
  httpLimiter,
  socketLimiter,
  socketConnectionLimiter,
} = require("./rateLimit");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  // Raise payload limit to allow image base64 (max ~2.7MB encoded from 2MB raw)
  maxHttpBufferSize: 3e6,
});

app.use(express.static(path.join(__dirname, "public")));

initRedis();
io.use(socketConnectionLimiter);

// ── In-memory state ──────────────────────────────────────────────────────────
const waitingQueues = { 2: [], 4: [], 6: [] };
const rooms    = {};
const userRoom = {};

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

function removeFromAllQueues(socketId) {
  for (const size of [2, 4, 6]) {
    waitingQueues[size] = waitingQueues[size].filter((id) => id !== socketId);
  }
}

function createRoom(users, size) {
  const roomId = generateRoomId();
  rooms[roomId] = { users: [...users], size, createdAt: Date.now() };
  for (const uid of users) {
    userRoom[uid] = roomId;
    io.sockets.sockets.get(uid)?.join(roomId);
    io.to(uid).emit("matched", { roomId, size });
  }
  console.log(`[room] created ${roomId} size=${size} → [${users.join(", ")}]`);
}

function leaveRoom(socketId) {
  const roomId = userRoom[socketId];
  if (!roomId || !rooms[roomId]) return;
  const room = rooms[roomId];
  const partners = room.users.filter((id) => id !== socketId);
  for (const partner of partners) {
    const ps = io.sockets.sockets.get(partner);
    if (ps) {
      ps.leave(roomId);
      delete userRoom[partner];
      io.to(partner).emit("partnerLeft");
      addToQueue(partner, room.size);
    }
  }
  io.sockets.sockets.get(socketId)?.leave(roomId);
  delete userRoom[socketId];
  delete rooms[roomId];
  console.log(`[room] destroyed ${roomId}`);
}

function addToQueue(socketId, size) {
  const q = waitingQueues[size];
  if (!q || q.includes(socketId)) return;
  q.push(socketId);
  io.to(socketId).emit("waiting", { size });
  console.log(`[queue:${size}] ${socketId} added — length: ${q.length}`);
  tryMatch(size);
}

function tryMatch(size) {
  const q = waitingQueues[size];
  while (q.length >= size) {
    const candidates = q.splice(0, size);
    const alive = candidates.filter((id) => io.sockets.sockets.has(id));
    const dead  = candidates.filter((id) => !io.sockets.sockets.has(id));
    if (alive.length === size) {
      createRoom(alive, size);
    } else {
      q.unshift(...alive);
      if (dead.length) console.log(`[queue:${size}] pruned ${dead.length} dead sockets`);
      break;
    }
  }
}

// ── Image validation ──────────────────────────────────────────────────────────
const MAX_IMG_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMG_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function validateImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return false;
  // Must start with data:image/...;base64,
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,/);
  if (!match) return false;
  if (!ALLOWED_IMG_TYPES.includes(match[1])) return false;
  // Check decoded byte size
  const base64 = dataUrl.split(",")[1];
  if (!base64) return false;
  const byteSize = Math.ceil((base64.length * 3) / 4);
  return byteSize <= MAX_IMG_BYTES;
}

// ── Socket.IO events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on("joinQueue", async ({ size }) => {
    if (!await socketLimiter("joinQueue", socket)) return;
    const s = [2, 4, 6].includes(Number(size)) ? Number(size) : 2;
    addToQueue(socket.id, s);
  });

  socket.on("message", async (text) => {
    if (!await socketLimiter("message", socket)) return;
    if (typeof text !== "string") return;
    const roomId = userRoom[socket.id];
    if (!roomId) return;
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    socket.to(roomId).emit("message", clean);
  });

  // ── NEW: image sharing ────────────────────────────────────────────────────
  socket.on("imageShare", async (dataUrl) => {
    if (!await socketLimiter("imageShare", socket)) return;
    const roomId = userRoom[socket.id];
    if (!roomId) return;
    if (!validateImageDataUrl(dataUrl)) {
      socket.emit("rateLimited", {
        action: "imageShare",
        retryAfter: 0,
        message: "Invalid or too-large image. Max 2 MB, JPEG/PNG/GIF/WebP only.",
      });
      return;
    }
    // Relay the base64 image directly to room partners
    socket.to(roomId).emit("imageShare", dataUrl);
  });

  socket.on("igShare", async (username) => {
    if (!await socketLimiter("igShare", socket)) return;
    if (typeof username !== "string") return;
    const roomId = userRoom[socket.id];
    if (!roomId) return;
    const clean = username.trim().replace(/^@/, "").slice(0, 30);
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(clean)) return;
    socket.to(roomId).emit("igShare", clean);
  });

  socket.on("skip", async ({ size } = {}) => {
    if (!await socketLimiter("skip", socket)) return;
    const roomId   = userRoom[socket.id];
    const roomSize = (roomId && rooms[roomId]?.size) || Number(size) || 2;
    leaveRoom(socket.id);
    addToQueue(socket.id, roomSize);
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    leaveRoom(socket.id);
    removeFromAllQueues(socket.id);
  });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get("/stats", (_req, res) => {
  res.json({
    online:      io.sockets.sockets.size,
    waiting:     Object.values(waitingQueues).reduce((a, q) => a + q.length, 0),
    activeRooms: Object.keys(rooms).length,
    queues:      { duo: waitingQueues[2].length, quad: waitingQueues[4].length, hexa: waitingQueues[6].length },
  });
});

app.use(express.json());
app.post("/report", httpLimiter("report"), (req, res) => {
  const { reportedSocketId, reason } = req.body || {};
  if (!reportedSocketId || typeof reportedSocketId !== "string") {
    return res.status(400).json({ error: "reportedSocketId is required" });
  }
  console.warn(`[report] socket=${reportedSocketId} reason=${reason || "none"}`);
  res.json({ ok: true, message: "Report received." });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀  Strangr running → http://localhost:${PORT}`));
