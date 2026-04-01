const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.static(path.join(__dirname, "public")));

// ── In-memory state ──────────────────────────────────────────────────────────
let waitingQueue = []; // socket IDs waiting for a match
const rooms = {};     // roomId → { users: [socketId, socketId] }
const userRoom = {};  // socketId → roomId  (reverse lookup)

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

function removeFromQueue(socketId) {
  waitingQueue = waitingQueue.filter((id) => id !== socketId);
}

function createRoom(socketA, socketB) {
  const roomId = generateRoomId();
  rooms[roomId] = { users: [socketA, socketB], createdAt: Date.now() };
  userRoom[socketA] = roomId;
  userRoom[socketB] = roomId;

  io.sockets.sockets.get(socketA)?.join(roomId);
  io.sockets.sockets.get(socketB)?.join(roomId);

  io.to(socketA).emit("matched", { roomId });
  io.to(socketB).emit("matched", { roomId });

  console.log(`[room] created ${roomId} → [${socketA}, ${socketB}]`);
}

function leaveRoom(socketId) {
  const roomId = userRoom[socketId];
  if (!roomId || !rooms[roomId]) return;

  const room = rooms[roomId];
  const partner = room.users.find((id) => id !== socketId);

  // Notify partner, re-queue them
  if (partner) {
    const partnerSocket = io.sockets.sockets.get(partner);
    if (partnerSocket) {
      partnerSocket.leave(roomId);
      delete userRoom[partner];
      io.to(partner).emit("partnerLeft");
      // Re-queue partner
      addToQueue(partner);
    }
  }

  // Clean up current user
  const mySocket = io.sockets.sockets.get(socketId);
  mySocket?.leave(roomId);
  delete userRoom[socketId];
  delete rooms[roomId];

  console.log(`[room] destroyed ${roomId}`);
}

function addToQueue(socketId) {
  if (!waitingQueue.includes(socketId)) {
    waitingQueue.push(socketId);
    io.to(socketId).emit("waiting");
    console.log(`[queue] ${socketId} added — queue length: ${waitingQueue.length}`);
    tryMatch();
  }
}

function tryMatch() {
  // Only match if both sockets are still connected
  while (waitingQueue.length >= 2) {
    const a = waitingQueue.shift();
    const b = waitingQueue.shift();

    const aAlive = io.sockets.sockets.has(a);
    const bAlive = io.sockets.sockets.has(b);

    if (aAlive && bAlive) {
      createRoom(a, b);
      return;
    }
    // One is dead — put the live one back
    if (aAlive) waitingQueue.unshift(a);
    if (bAlive) waitingQueue.unshift(b);
  }
}

// ── Socket.IO events ─────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Immediately try to match the new user
  addToQueue(socket.id);

  // Chat message
  socket.on("message", (text) => {
    if (typeof text !== "string") return;
    const roomId = userRoom[socket.id];
    if (!roomId) return;
    const clean = text.trim().slice(0, 500); // cap at 500 chars
    if (!clean) return;
    socket.to(roomId).emit("message", clean);
  });

  // Skip / next stranger
  socket.on("skip", () => {
    leaveRoom(socket.id);
    addToQueue(socket.id);
  });

  // Clean disconnect
  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    leaveRoom(socket.id);
    removeFromQueue(socket.id);
  });
});

// ── Stats endpoint (optional) ─────────────────────────────────────────────────
app.get("/stats", (_req, res) => {
  res.json({
    online: io.sockets.sockets.size,
    waiting: waitingQueue.length,
    activeRooms: Object.keys(rooms).length,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀  Strangr running → http://localhost:${PORT}`);
});
