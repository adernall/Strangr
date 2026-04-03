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
  maxHttpBufferSize: 3e6,
});

app.use(express.static(path.join(__dirname, "public")));

initRedis();
io.use(socketConnectionLimiter);

// ── In-memory state ──────────────────────────────────────────────────────────
const waitingQueues = { 2: [], 4: [], 6: [] };
const rooms         = {};   // roomId → { users:[], size, createdAt, private? }
const userRoom      = {};   // socketId → roomId
const privateRooms  = {};   // code → { creator: socketId, createdAt }
const nicknames     = {};   // socketId → nickname string

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

function generatePrivateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    if (i === 3) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function removeFromAllQueues(socketId) {
  for (const size of [2, 4, 6]) {
    waitingQueues[size] = waitingQueues[size].filter((id) => id !== socketId);
  }
}

function createRoom(users, size, isPrivate = false) {
  const roomId = generateRoomId();
  rooms[roomId] = { users: [...users], size, createdAt: Date.now(), private: isPrivate };
  for (const uid of users) {
    userRoom[uid] = roomId;
    io.sockets.sockets.get(uid)?.join(roomId);
    io.to(uid).emit("matched", { roomId, size, private: isPrivate });
  }
  // After matching, relay each user's nickname to their partners
  for (const uid of users) {
    const nick = nicknames[uid];
    if (nick) {
      const partners = users.filter((id) => id !== uid);
      for (const partner of partners) {
        io.to(partner).emit("partnerNickname", nick);
      }
    }
  }
  console.log(`[room] created ${roomId} size=${size} private=${isPrivate}`);
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
      if (!room.private) addToQueue(partner, room.size);
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
const MAX_IMG_BYTES    = 2 * 1024 * 1024;
const ALLOWED_IMG_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function validateImageDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return false;
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,/);
  if (!match) return false;
  if (!ALLOWED_IMG_TYPES.includes(match[1])) return false;
  const base64 = dataUrl.split(",")[1];
  if (!base64) return false;
  return Math.ceil((base64.length * 3) / 4) <= MAX_IMG_BYTES;
}

// Cleanup stale private codes after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of Object.entries(privateRooms)) {
    if (now - data.createdAt > 10 * 60_000) delete privateRooms[code];
  }
}, 60_000);

// ── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Queue ──────────────────────────────────────────────────────────────────
  socket.on("joinQueue", async ({ size }) => {
    if (!await socketLimiter("joinQueue", socket)) return;
    const s = [2, 4, 6].includes(Number(size)) ? Number(size) : 2;
    addToQueue(socket.id, s);
  });

  // ── Nickname ────────────────────────────────────────────────────────────────
  socket.on("myNickname", (name) => {
    if (typeof name !== "string") return;
    const clean = name.trim().slice(0, 20);
    if (!clean) return;
    nicknames[socket.id] = clean;

    // If already in a room, relay to partners immediately
    const roomId = userRoom[socket.id];
    if (roomId && rooms[roomId]) {
      const partners = rooms[roomId].users.filter((id) => id !== socket.id);
      for (const partner of partners) {
        io.to(partner).emit("partnerNickname", clean);
      }
    }
  });

  // ── Private rooms ───────────────────────────────────────────────────────────
  socket.on("createPrivateRoom", () => {
    leaveRoom(socket.id);
    removeFromAllQueues(socket.id);

    // Remove any existing pending code for this socket
    for (const [code, data] of Object.entries(privateRooms)) {
      if (data.creator === socket.id) delete privateRooms[code];
    }

    let code; let tries = 0;
    do { code = generatePrivateCode(); tries++; }
    while (privateRooms[code] && tries < 20);

    privateRooms[code] = { creator: socket.id, createdAt: Date.now() };
    socket.emit("privateRoomCreated", { code });
    console.log(`[private] code=${code} creator=${socket.id}`);
  });

  socket.on("joinPrivateRoom", (rawCode) => {
    if (typeof rawCode !== "string") return;
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const entry = privateRooms[code];

    if (!entry) { socket.emit("privateRoomError", "Invalid or expired code."); return; }
    if (entry.creator === socket.id) { socket.emit("privateRoomError", "You created this room — share the code with a friend."); return; }
    const creator = io.sockets.sockets.get(entry.creator);
    if (!creator) { delete privateRooms[code]; socket.emit("privateRoomError", "Room creator has disconnected."); return; }

    leaveRoom(socket.id);
    leaveRoom(entry.creator);
    removeFromAllQueues(socket.id);
    removeFromAllQueues(entry.creator);
    delete privateRooms[code];

    createRoom([entry.creator, socket.id], 2, true);
  });

  // ── Chat ────────────────────────────────────────────────────────────────────
  socket.on("message", async (text) => {
    if (!await socketLimiter("message", socket)) return;
    if (typeof text !== "string") return;
    const roomId = userRoom[socket.id];
    if (!roomId) return;
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    socket.to(roomId).emit("message", clean);
  });

  socket.on("imageShare", async (dataUrl) => {
    if (!await socketLimiter("imageShare", socket)) return;
    const roomId = userRoom[socket.id];
    if (!roomId) return;
    if (!validateImageDataUrl(dataUrl)) {
      socket.emit("rateLimited", { action: "imageShare", retryAfter: 0, message: "Invalid or too-large image." });
      return;
    }
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

  socket.on("typing", (isTyping) => {
    const roomId = userRoom[socket.id];
    if (!roomId) return;
    socket.to(roomId).emit("typing", !!isTyping);
  });

  socket.on("skip", async ({ size } = {}) => {
    if (!await socketLimiter("skip", socket)) return;
    const roomId  = userRoom[socket.id];
    const room    = roomId && rooms[roomId];
    if (room?.private) {
      leaveRoom(socket.id);
      socket.emit("backToHome");
      return;
    }
    const roomSize = room?.size || Number(size) || 2;
    leaveRoom(socket.id);
    addToQueue(socket.id, roomSize);
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    for (const [code, data] of Object.entries(privateRooms)) {
      if (data.creator === socket.id) delete privateRooms[code];
    }
    delete nicknames[socket.id];
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
