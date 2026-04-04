/**
 * moderation.js — Strangr moderation module
 *
 * Responsibilities:
 *   - User record management (in-memory + users.json)
 *   - Keyword loading from keywords.txt
 *   - Message scanning + flag system
 *   - Report system (combines flags + reports for auto-temp-ban)
 *   - Ban / unban (temporary + permanent)
 *   - Admin token auth
 *
 * Design rules:
 *   - Zero impact on existing chat logic unless user is banned
 *   - Keywords loaded ONCE at startup — no per-message file reads
 *   - All writes debounced to avoid hammering disk on high traffic
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── Config ────────────────────────────────────────────────────────────────────
const USERS_FILE    = path.join(__dirname, "users.json");
const KEYWORDS_FILE = path.join(__dirname, "keywords.txt");

// Change this password — or set ADMIN_PASSWORD env var
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "strangr-admin-2026";

// Ban durations
const TEMP_BAN_MS        = 10 * 60 * 1000;   // 10 minutes
const TEMP_BAN_THRESHOLD = 3;                 // reports before temp ban
const PERM_BAN_THRESHOLD = 3;                 // temp bans before perm ban
const FLAG_REPORT_COMBO  = { flags: 2, reports: 1 }; // combo for auto temp-ban

// Max last-messages stored per user
const MAX_LAST_MSGS = 20;

// Admin session tokens — in-memory only (reset on server restart, intentional)
const adminTokens = new Set();
const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ── In-memory user store ──────────────────────────────────────────────────────
// { [userId]: { reports, flags, tempBans, status, lastMessages, lastActive, banUntil?, reports_detail[] } }
let users = {};

// ── Load users from disk ──────────────────────────────────────────────────────
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf8");
      users = JSON.parse(raw);
      console.log(`[moderation] Loaded ${Object.keys(users).length} users from users.json`);
    } else {
      users = {};
      console.log("[moderation] No users.json found — starting fresh");
    }
  } catch (err) {
    console.error("[moderation] Failed to load users.json:", err.message);
    users = {};
  }
}

// ── Save users to disk (debounced 2s to batch rapid writes) ──────────────────
let saveTimer = null;
function saveUsers() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
    } catch (err) {
      console.error("[moderation] Failed to save users.json:", err.message);
    }
  }, 2000);
}

// ── Keyword loading ───────────────────────────────────────────────────────────
let keywords = [];

function loadKeywords() {
  try {
    if (fs.existsSync(KEYWORDS_FILE)) {
      const raw = fs.readFileSync(KEYWORDS_FILE, "utf8");
      keywords = raw
        .split("\n")
        .map(l => l.trim().toLowerCase())
        .filter(l => l.length > 0 && !l.startsWith("#"));
      console.log(`[moderation] Loaded ${keywords.length} keywords from keywords.txt`);
    } else {
      keywords = [];
      console.log("[moderation] No keywords.txt found — keyword scanning disabled");
    }
  } catch (err) {
    console.error("[moderation] Failed to load keywords.txt:", err.message);
    keywords = [];
  }
}

// ── Message normalisation for keyword matching ────────────────────────────────
// "s e x!!" → "sex" | "S*X" → "sx"
function normalizeMessage(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // strip everything except letters/digits
}

// ── Ensure user record exists ─────────────────────────────────────────────────
function ensureUser(userId) {
  if (!users[userId]) {
    users[userId] = {
      reports:       0,
      flags:         0,
      tempBans:      0,
      status:        "active",
      lastMessages:  [],
      lastActive:    Date.now(),
      reports_detail: [],
    };
  }
  return users[userId];
}

// ── Check if user is currently banned ─────────────────────────────────────────
function isBanned(userId) {
  const u = users[userId];
  if (!u) return false;
  if (u.status === "perm_banned") return true;
  if (u.status === "temp_banned") {
    if (u.banUntil && Date.now() < u.banUntil) return true;
    // Ban expired — lift it automatically
    u.status    = "active";
    u.banUntil  = null;
    saveUsers();
    return false;
  }
  return false;
}

// ── Scan message for keywords, return matched keywords ────────────────────────
function scanMessage(text) {
  if (keywords.length === 0) return [];
  const norm    = normalizeMessage(text);
  const matched = keywords.filter(kw => norm.includes(kw));
  return matched;
}

// ── Record a message + scan keywords ──────────────────────────────────────────
// Returns { flagged: bool, keywords: string[] }
function recordMessage(userId, text) {
  const u = ensureUser(userId);
  u.lastActive = Date.now();

  // Store last N messages
  u.lastMessages.push({ text: text.slice(0, 500), at: Date.now() });
  if (u.lastMessages.length > MAX_LAST_MSGS) {
    u.lastMessages.shift();
  }

  // Keyword scan
  const matched = scanMessage(text);
  if (matched.length > 0) {
    u.flags = (u.flags || 0) + 1;
    saveUsers();
    console.log(`[moderation] userId=${userId} flagged (flags=${u.flags}) keywords=[${matched.join(",")}]`);
    // Check combo trigger
    checkComboBan(userId);
    return { flagged: true, keywords: matched };
  }

  saveUsers();
  return { flagged: false, keywords: [] };
}

// ── Combo ban: flags + reports ─────────────────────────────────────────────────
function checkComboBan(userId) {
  const u = users[userId];
  if (!u || u.status !== "active") return;
  if (u.flags >= FLAG_REPORT_COMBO.flags && u.reports >= FLAG_REPORT_COMBO.reports) {
    applyTempBan(userId, "auto: keyword+report combo");
  }
}

// ── Report a user ──────────────────────────────────────────────────────────────
// Returns { banned: bool, banType: "temp"|"perm"|null }
function reportUser(userId, reason = "unspecified") {
  const u = ensureUser(userId);
  u.reports    = (u.reports || 0) + 1;
  u.lastActive = Date.now();
  u.reports_detail = u.reports_detail || [];
  u.reports_detail.push({ reason, at: Date.now() });
  // Keep only last 50 report records
  if (u.reports_detail.length > 50) u.reports_detail.shift();

  console.log(`[moderation] userId=${userId} reported (total=${u.reports}) reason="${reason}"`);

  // Check report threshold
  if (u.status === "active" && u.reports >= TEMP_BAN_THRESHOLD) {
    return applyTempBan(userId, "auto: report threshold");
  }

  // Check combo
  checkComboBan(userId);

  saveUsers();
  return { banned: false, banType: null };
}

// ── Apply temporary ban ────────────────────────────────────────────────────────
function applyTempBan(userId, reason = "manual") {
  const u = ensureUser(userId);
  u.tempBans   = (u.tempBans || 0) + 1;
  u.lastActive = Date.now();

  if (u.tempBans >= PERM_BAN_THRESHOLD) {
    u.status   = "perm_banned";
    u.banUntil = null;
    console.log(`[moderation] userId=${userId} PERMANENTLY BANNED (tempBans=${u.tempBans}) reason="${reason}"`);
    saveUsers();
    return { banned: true, banType: "perm" };
  }

  u.status   = "temp_banned";
  u.banUntil = Date.now() + TEMP_BAN_MS;
  console.log(`[moderation] userId=${userId} TEMP BANNED until=${new Date(u.banUntil).toISOString()} reason="${reason}"`);
  saveUsers();
  return { banned: true, banType: "temp" };
}

// ── Apply permanent ban ────────────────────────────────────────────────────────
function applyPermBan(userId) {
  const u = ensureUser(userId);
  u.status   = "perm_banned";
  u.banUntil = null;
  u.lastActive = Date.now();
  console.log(`[moderation] userId=${userId} PERMANENTLY BANNED (manual)`);
  saveUsers();
  return { banned: true, banType: "perm" };
}

// ── Unban a user ───────────────────────────────────────────────────────────────
function unbanUser(userId) {
  const u = ensureUser(userId);
  u.status   = "active";
  u.banUntil = null;
  u.reports  = 0;
  u.flags    = 0;
  u.tempBans = 0;
  u.reports_detail = [];
  console.log(`[moderation] userId=${userId} UNBANNED (manual)`);
  saveUsers();
}

// ── Update lastActive ──────────────────────────────────────────────────────────
function touchUser(userId) {
  const u = ensureUser(userId);
  u.lastActive = Date.now();
  // No immediate save — will be saved on next real event
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ══════════════════════════════════════════════════════════════════════════════
function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiry = Date.now() + TOKEN_TTL_MS;
  adminTokens.add(token);
  // Auto-expire
  setTimeout(() => adminTokens.delete(token), TOKEN_TTL_MS);
  return token;
}

function validateAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}

function validateAdminToken(token) {
  return typeof token === "string" && adminTokens.has(token);
}

function revokeToken(token) {
  adminTokens.delete(token);
}

// ── Admin middleware ───────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (!validateAdminToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN HTTP ROUTES
// Register these in server.js with: require("./moderation").registerAdminRoutes(app)
// ══════════════════════════════════════════════════════════════════════════════
function registerAdminRoutes(app, express) {

  // Serve admin panel HTML (password wall is client-side; token auth protects API)
  app.get("/admin-secret", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
  });

  // ── Login ──────────────────────────────────────────────────────────────────
  app.post("/admin-secret/login", express.json(), (req, res) => {
    const { password } = req.body || {};
    if (!validateAdminPassword(password)) {
      return res.status(401).json({ error: "Wrong password" });
    }
    const token = generateToken();
    res.json({ ok: true, token });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post("/admin-secret/logout", adminAuth, (req, res) => {
    const token = req.headers["x-admin-token"];
    revokeToken(token);
    res.json({ ok: true });
  });

  // ── Get all users ──────────────────────────────────────────────────────────
  app.get("/admin-secret/users", adminAuth, (_req, res) => {
    // Return sanitised snapshot (don't expose raw message content in listing, only on detail)
    const snapshot = Object.entries(users).map(([userId, u]) => ({
      userId,
      status:      u.status,
      reports:     u.reports || 0,
      flags:       u.flags   || 0,
      tempBans:    u.tempBans || 0,
      lastActive:  u.lastActive || 0,
      banUntil:    u.banUntil || null,
      msgCount:    (u.lastMessages || []).length,
    }));
    // Sort: banned first, then by reports desc
    snapshot.sort((a, b) => {
      const statusOrder = { perm_banned: 0, temp_banned: 1, active: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return (b.reports + b.flags) - (a.reports + a.flags);
    });
    res.json(snapshot);
  });

  // ── Get single user detail ─────────────────────────────────────────────────
  app.get("/admin-secret/users/:userId", adminAuth, (req, res) => {
    const u = users[req.params.userId];
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json({ userId: req.params.userId, ...u });
  });

  // ── Temp ban ───────────────────────────────────────────────────────────────
  app.post("/admin-secret/ban/temp", adminAuth, express.json(), (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = applyTempBan(userId, "manual admin");
    res.json({ ok: true, ...result, user: users[userId] });
  });

  // ── Perm ban ───────────────────────────────────────────────────────────────
  app.post("/admin-secret/ban/perm", adminAuth, express.json(), (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = applyPermBan(userId);
    res.json({ ok: true, ...result, user: users[userId] });
  });

  // ── Unban ──────────────────────────────────────────────────────────────────
  app.post("/admin-secret/unban", adminAuth, express.json(), (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    unbanUser(userId);
    res.json({ ok: true, user: users[userId] });
  });

  // ── Admin stats ────────────────────────────────────────────────────────────
  app.get("/admin-secret/stats", adminAuth, (_req, res) => {
    const all = Object.values(users);
    res.json({
      total:       all.length,
      active:      all.filter(u => u.status === "active").length,
      tempBanned:  all.filter(u => u.status === "temp_banned").length,
      permBanned:  all.filter(u => u.status === "perm_banned").length,
      totalFlags:  all.reduce((s, u) => s + (u.flags || 0), 0),
      totalReports:all.reduce((s, u) => s + (u.reports || 0), 0),
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
loadUsers();
loadKeywords();

module.exports = {
  // Core
  isBanned,
  recordMessage,
  reportUser,
  applyTempBan,
  applyPermBan,
  unbanUser,
  touchUser,
  ensureUser,
  // Admin
  registerAdminRoutes,
  validateAdminPassword,
  validateAdminToken,
  adminAuth,
  // Data
  users,       // exported so server.js can read for in-memory decisions
  keywords,    // exported for info
};
