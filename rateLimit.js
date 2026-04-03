/**
 * rateLimit.js — Strangr. rate limiting system
 *
 * ARCHITECTURE:
 *   Two backends are supported, chosen automatically at startup:
 *     1. Redis  — preferred for production / multi-process deployments.
 *                 Set REDIS_URL env var (e.g. redis://localhost:6379).
 *     2. In-memory (Map) — automatic fallback when Redis is unavailable.
 *                 Works perfectly for a single-process deployment like Render.
 *
 * ALGORITHM: Sliding Window Counter
 *   Each key stores a sorted list of timestamps.
 *   On every request we:
 *     1. Drop timestamps older than the window.
 *     2. Count remaining hits.
 *     3. If count >= limit → DENY (429).
 *     4. Otherwise → record this timestamp and ALLOW.
 *   This gives smooth, accurate limiting with no "boundary burst" problem
 *   that fixed-window counters suffer from.
 *
 * KEYS FORMAT:
 *   rl:<action>:<identifier>
 *   e.g.  rl:message:192.168.1.1
 *         rl:skip:abc123socketid
 *         rl:connect:10.0.0.5
 */

"use strict";

// ── Config — tweak these values freely ───────────────────────────────────────
const LIMITS = {
  //          max hits   window (ms)   cooldown after ban (ms)
  connect:  { max: 10,  window: 60_000,  cooldown: 60_000  },  // 10 new connections / min / IP
  joinQueue:{ max: 20,  window: 60_000,  cooldown: 30_000  },  // 20 queue joins / min / socket
  message:  { max: 30,  window: 10_000,  cooldown: 10_000  },  // 30 messages / 10s / socket
  skip:     { max: 10,  window: 60_000,  cooldown: 30_000  },  // 10 skips / min / socket
  igShare:  { max: 5,   window: 60_000,  cooldown: 60_000  },  // 5 IG shares / min / socket
  report:   { max: 5,   window: 300_000, cooldown: 300_000 },  // 5 reports / 5min / socket+IP
};

// ── Backend: try Redis, fall back to in-memory ────────────────────────────────
let redisClient = null;

async function initRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return false;
  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });
    await redisClient.connect();
    console.log("[rateLimit] Redis connected ✓");
    return true;
  } catch (err) {
    console.warn("[rateLimit] Redis unavailable, using in-memory fallback:", err.message);
    redisClient = null;
    return false;
  }
}

// ── In-memory store (fallback) ────────────────────────────────────────────────
// Map<key, { hits: number[], bannedUntil: number }>
const memStore = new Map();

// Prune old entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memStore) {
    if (data.bannedUntil && data.bannedUntil < now) {
      data.bannedUntil = 0;
    }
    // Find the config for this key's action
    const action = key.split(":")[1];
    const cfg = LIMITS[action];
    if (cfg) {
      data.hits = data.hits.filter((t) => now - t < cfg.window);
    }
    if (!data.hits.length && !data.bannedUntil) {
      memStore.delete(key);
    }
  }
}, 5 * 60_000);

// ── Core check function ───────────────────────────────────────────────────────
/**
 * checkLimit(action, identifier)
 *
 * @param {string} action     - key into LIMITS config (e.g. "message")
 * @param {string} identifier - IP address or socket ID (or "ip:socketId" combo)
 * @returns {{ allowed: boolean, retryAfter: number }}
 *          allowed    = true if request should proceed
 *          retryAfter = seconds until they can retry (0 if allowed)
 */
async function checkLimit(action, identifier) {
  const cfg = LIMITS[action];
  if (!cfg) return { allowed: true, retryAfter: 0 }; // unknown action = pass-through

  const key = `rl:${action}:${identifier}`;
  const now = Date.now();

  if (redisClient) {
    return await redisCheck(key, cfg, now);
  }
  return memCheck(key, cfg, now);
}

// ── Redis implementation ──────────────────────────────────────────────────────
async function redisCheck(key, cfg, now) {
  const banKey = `${key}:ban`;

  try {
    // Check if currently banned
    const banTtl = await redisClient.pttl(banKey);
    if (banTtl > 0) {
      return { allowed: false, retryAfter: Math.ceil(banTtl / 1000) };
    }

    const windowStart = now - cfg.window;

    // Atomic sliding window using a sorted set (score = timestamp)
    const pipeline = redisClient.pipeline();
    pipeline.zremrangebyscore(key, "-inf", windowStart);   // drop old hits
    pipeline.zadd(key, now, `${now}-${Math.random()}`);    // record this hit
    pipeline.zcard(key);                                   // count hits in window
    pipeline.pexpire(key, cfg.window);                     // auto-expire key

    const results = await pipeline.exec();
    const count = results[2][1]; // zcard result

    if (count > cfg.max) {
      // Set a ban key with TTL
      await redisClient.set(banKey, "1", "PX", cfg.cooldown);
      const retryAfter = Math.ceil(cfg.cooldown / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    // Redis error → fail open (allow request) to avoid false blocks
    console.error("[rateLimit] Redis error, failing open:", err.message);
    return { allowed: true, retryAfter: 0 };
  }
}

// ── In-memory implementation ──────────────────────────────────────────────────
function memCheck(key, cfg, now) {
  let data = memStore.get(key);
  if (!data) {
    data = { hits: [], bannedUntil: 0 };
    memStore.set(key, data);
  }

  // Check ban
  if (data.bannedUntil && now < data.bannedUntil) {
    const retryAfter = Math.ceil((data.bannedUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Slide window: drop timestamps outside the window
  const windowStart = now - cfg.window;
  data.hits = data.hits.filter((t) => t > windowStart);

  if (data.hits.length >= cfg.max) {
    data.bannedUntil = now + cfg.cooldown;
    const retryAfter = Math.ceil(cfg.cooldown / 1000);
    return { allowed: false, retryAfter };
  }

  data.hits.push(now);
  return { allowed: true, retryAfter: 0 };
}

// ── Dual key check (IP + socketId combined) ───────────────────────────────────
/**
 * checkDual(action, ip, socketId)
 * Checks BOTH the IP and the socket independently.
 * Both must pass — whichever hits the limit first blocks the request.
 * This prevents:
 *   - One IP cycling through socket IDs to evade per-socket limits
 *   - One socket on a shared IP getting unfairly blocked by others
 */
async function checkDual(action, ip, socketId) {
  const [byIp, bySocket] = await Promise.all([
    checkLimit(action, ip),
    checkLimit(action, socketId),
  ]);

  if (!byIp.allowed)     return { allowed: false, retryAfter: byIp.retryAfter,    blockedBy: "ip" };
  if (!bySocket.allowed) return { allowed: false, retryAfter: bySocket.retryAfter, blockedBy: "socket" };
  return { allowed: true, retryAfter: 0 };
}

// ── Express HTTP middleware factory ──────────────────────────────────────────
/**
 * httpLimiter(action)
 * Returns an Express middleware that rate-limits by IP.
 * Usage: app.post("/report", httpLimiter("report"), handler)
 */
function httpLimiter(action) {
  return async (req, res, next) => {
    const ip = getIp(req);
    const result = await checkLimit(action, ip);
    if (!result.allowed) {
      res.set("Retry-After", String(result.retryAfter));
      return res.status(429).json({
        error: "Too many requests",
        retryAfter: result.retryAfter,
        message: `Rate limit exceeded. Try again in ${result.retryAfter}s.`,
      });
    }
    next();
  };
}

// ── Socket.IO middleware factory ──────────────────────────────────────────────
/**
 * socketLimiter(action, socket)
 * Call inside a socket event handler. Returns false and emits "rateLimited"
 * if the event is blocked.
 *
 * Usage:
 *   socket.on("message", async (text) => {
 *     if (!await socketLimiter("message", socket)) return;
 *     // ... handle message
 *   });
 */
async function socketLimiter(action, socket) {
  const ip = getSocketIp(socket);
  const result = await checkDual(action, ip, socket.id);

  if (!result.allowed) {
    socket.emit("rateLimited", {
      action,
      retryAfter: result.retryAfter,
      message: `Slow down! You can retry in ${result.retryAfter}s.`,
    });
    console.warn(`[rateLimit] BLOCKED ${action} — socket=${socket.id} ip=${ip} retry=${result.retryAfter}s`);
    return false;
  }
  return true;
}

// ── Socket.IO connection-level middleware ─────────────────────────────────────
/**
 * Use as: io.use(socketConnectionLimiter)
 * Blocks new connections from IPs that are connecting too fast.
 */
async function socketConnectionLimiter(socket, next) {
  const ip = getSocketIp(socket);
  const result = await checkLimit("connect", ip);

  if (!result.allowed) {
    console.warn(`[rateLimit] BLOCKED connection from ${ip} — retry in ${result.retryAfter}s`);
    return next(new Error("Too many connections. Try again later."));
  }
  next();
}

// ── IP extraction helpers ─────────────────────────────────────────────────────
function getIp(req) {
  // Trust X-Forwarded-For from Render/Vercel proxies
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function getSocketIp(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return socket.handshake.address || "unknown";
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  initRedis,
  checkLimit,
  checkDual,
  httpLimiter,
  socketLimiter,
  socketConnectionLimiter,
  LIMITS, // exported so you can read/log config
};
