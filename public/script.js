/* ── Strangr v5 — client script ─────────────────────────────────────────────── */
"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// DOM REFS
// ══════════════════════════════════════════════════════════════════════════════

// Screens
const homeScreen = document.getElementById("homeScreen");
const chatScreen = document.getElementById("chatScreen");

// Home
const btnStart = document.getElementById("btnStart");
const btnBack = document.getElementById("btnBack");
const nicknameInput = document.getElementById("nicknameInput");
const onlineCountHome = document.getElementById("onlineCountHome");
const btnShowPrivate = document.getElementById("btnShowPrivate");
const privatePanel = document.getElementById("privatePanel");
const privateCodeInput = document.getElementById("privateCodeInput");
const btnJoinPrivate = document.getElementById("btnJoinPrivate");
const btnCreatePrivate = document.getElementById("btnCreatePrivate");

// Chat
const messagesEl = document.getElementById("messages");
const emptyStateEl = document.getElementById("emptyState");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const roomTag = document.getElementById("roomTag");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const skipBtn = document.getElementById("skipBtn");
const charCountEl = document.getElementById("charCount");
const onlineCount = document.getElementById("onlineCount");
const typingIndicator = document.getElementById("typingIndicator");
const typingLabel = document.getElementById("typingLabel");

// Image
const btnImg = document.getElementById("btnImg");
const imageInput = document.getElementById("imageInput");
const imgPreviewSlot = document.getElementById("imgPreviewSlot");

// Instagram
const igModal = document.getElementById("igModal");
const igInput = document.getElementById("igInput");
const igModalClose = document.getElementById("igModalClose");
const igModalCancel = document.getElementById("igModalCancel");
const igModalSave = document.getElementById("igModalSave");
const btnIgAdd = document.getElementById("btnIgAdd");
const btnIgShare = document.getElementById("btnIgShare");

// Private room modal
const privateCreatedModal = document.getElementById("privateCreatedModal");
const privateCreatedClose = document.getElementById("privateCreatedClose");
const privateCodeDisplay = document.getElementById("privateCodeDisplay");
const btnCopyCode = document.getElementById("btnCopyCode");

// Legal
const legalModal = document.getElementById("legalModal");
const legalModalClose = document.getElementById("legalModalClose");
const legalBody = document.getElementById("legalBody");

// Nav more
const btnNavMore = document.getElementById("btnNavMore");
const navDropdown = document.getElementById("navDropdown");
const themeToggle = document.getElementById("themeToggle");
const themeLabel = document.getElementById("themeLabel");
const mainNav = document.getElementById("mainNav");

// Toast
const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(msg, type = "", duration = 3500) {
  toastEl.textContent = msg;
  toastEl.className = `toast show${type ? " toast-" + type : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = "toast"; }, duration);
}

// ══════════════════════════════════════════════════════════════════════════════
// THEME SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
const THEME_KEY = "strangr_theme";
let currentTheme = localStorage.getItem(THEME_KEY) || "light";

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  if (themeLabel) themeLabel.textContent = theme === "dark" ? "Dark" : "Light";
}

// Init theme on load
applyTheme(currentTheme);

// Theme toggle click
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// NAV — scroll effect + dropdown
// ══════════════════════════════════════════════════════════════════════════════
if (mainNav) {
  homeScreen.addEventListener("scroll", () => {
    mainNav.classList.toggle("scrolled", homeScreen.scrollTop > 20);
  });
}

// More dropdown toggle (click, not hover)
if (btnNavMore) {
  btnNavMore.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !navDropdown.classList.contains("hidden");
    navDropdown.classList.toggle("hidden", isOpen);
    btnNavMore.setAttribute("aria-expanded", String(!isOpen));
  });
}
// Close on outside click
document.addEventListener("click", (e) => {
  if (navDropdown && !navDropdown.classList.contains("hidden")) {
    if (!document.getElementById("navMoreWrap")?.contains(e.target)) {
      navDropdown.classList.add("hidden");
      btnNavMore?.setAttribute("aria-expanded", "false");
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════
let connected = false;
let roomSize = 2;
let isPrivateRoom = false;
let myIgHandle = null;
let pendingImg = null;

// Nickname — my own + partner's
let myNickname = "";  // set from input
let partnerNickname = "";  // received from partner via socket

// ── userId — persistent anonymous ID ─────────────────────────────────────────
// Generated once, stored in localStorage, survives page reloads/nickname changes
const USER_ID_KEY = "strangr_user_id";
let myUserId = localStorage.getItem(USER_ID_KEY);
if (!myUserId) {
  myUserId = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, myUserId);
}

// Track partner's userId so we can report them
let partnerUserId = "";

// ══════════════════════════════════════════════════════════════════════════════
// SOCKET
// ══════════════════════════════════════════════════════════════════════════════
const socket = io({ transports: ["websocket", "polling"], autoConnect: false });

// ══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
let notifPermission = Notification?.permission ?? "denied";

async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (notifPermission === "granted" || notifPermission === "denied") return;
  notifPermission = await Notification.requestPermission();
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [[523.25, now], [659.25, now + 0.18]].forEach(([freq, start]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
      osc.start(start); osc.stop(start + 0.7);
    });
  } catch { /* ignore */ }
}

function notifyUser(title, body) {
  if (document.visibilityState === "visible") return;
  playChime();
  if (notifPermission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
        tag: "strangr-match", renotify: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* ignore */ }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
function showHome() {
  homeScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
  document.title = "Strangr — Talk to Strangers Instantly";
}

function showChat(size, privateMode = false) {
  // Read nickname from input
  myNickname = nicknameInput?.value.trim().slice(0, 20) || "";
  roomSize = size;
  isPrivateRoom = privateMode;
  partnerNickname = "";
  partnerUserId = "";

  homeScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  document.title = "Strangr — Chatting…";

  requestNotifPermission();

  if (!privateMode) {
    if (socket.connected) {
      // Already connected — identify was already sent on connect,
      // just emit joinQueue directly
      socket.emit("joinQueue", { size });
      if (myNickname) socket.emit("myNickname", myNickname);
    } else {
      // Not yet connected — store the queue join so the connect handler
      // sends identify THEN joinQueue in the correct order
      pendingQueueJoin = { size };
      socket.connect();
    }
  } else {
    // Private room — just connect; the caller will emit createPrivateRoom/joinPrivateRoom
    if (!socket.connected) socket.connect();
  }
}

// Start chatting
btnStart?.addEventListener("click", () => showChat(2));

// Group rooms
document.querySelectorAll(".btn-group-pill").forEach((btn) => {
  btn.addEventListener("click", () => showChat(Number(btn.dataset.size)));
});

// Back
btnBack?.addEventListener("click", () => {
  if (connected) socket.emit("skip", { size: roomSize });
  stopTyping();
  socket.disconnect();
  connected = false;
  isPrivateRoom = false;
  partnerNickname = "";
  partnerUserId = "";   // NEW
  showTypingIndicator(false);
  clearMessages();
  clearPendingImg();
  hideReportBtn(); // NEW
  showHome();
});

// ══════════════════════════════════════════════════════════════════════════════
// PRIVATE ROOM PANEL (inline expand)
// ══════════════════════════════════════════════════════════════════════════════
btnShowPrivate?.addEventListener("click", () => {
  privatePanel.classList.toggle("hidden");
  if (!privatePanel.classList.contains("hidden")) {
    privateCodeInput?.focus();
  }
});

btnCreatePrivate?.addEventListener("click", () => {
  showChat(2, true);
  // If socket just connected, identify fires in connect handler first, then this
  if (socket.connected) {
    socket.emit("identify", myUserId); // re-send in case already connected
    socket.emit("createPrivateRoom");
  } else {
    // Queue it — connect handler will send identify, then we need to create room
    // Use a one-time listener
    socket.once("connect", () => {
      socket.emit("createPrivateRoom");
    });
  }
});

btnJoinPrivate?.addEventListener("click", () => {
  const code = privateCodeInput?.value.trim().toUpperCase();
  if (!code) { showToast("Enter a room code first.", "warn"); return; }
  showChat(2, true);
  if (socket.connected) {
    socket.emit("identify", myUserId);
    socket.emit("joinPrivateRoom", code);
  } else {
    socket.once("connect", () => {
      socket.emit("joinPrivateRoom", code);
    });
  }
});

privateCodeInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); btnJoinPrivate?.click(); }
});

// Auto-format: uppercase + dash after 3 chars
privateCodeInput?.addEventListener("input", (e) => {
  let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (v.length > 3) v = v.slice(0, 3) + "-" + v.slice(3, 6);
  e.target.value = v;
});

// Private room socket events
socket.on("privateRoomCreated", ({ code }) => {
  privateCodeDisplay.textContent = code;
  privateCreatedModal.classList.remove("hidden");
  setStatus("waiting", "Waiting for friend…");
});

socket.on("privateRoomError", (msg) => {
  showToast(msg, "error");
  stopTyping();
  socket.disconnect();
  connected = false;
  showHome();
});

socket.on("backToHome", () => {
  connected = false;
  isPrivateRoom = false;
  stopTyping();
  socket.disconnect();
  clearMessages();
  showHome();
  showToast("Private room closed.", "warn");
});

privateCreatedClose?.addEventListener("click", () => {
  privateCreatedModal.classList.add("hidden");
  stopTyping();
  socket.disconnect();
  connected = false;
  isPrivateRoom = false;
  clearMessages();
  showHome();
});

btnCopyCode?.addEventListener("click", () => {
  const code = privateCodeDisplay.textContent;
  navigator.clipboard?.writeText(code)
    .then(() => showToast("Code copied!", "success"))
    .catch(() => showToast(`Code: ${code}`, "success", 6000));
});

// ══════════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function setStatus(state, text) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = text;
}

function setInputEnabled(enabled) {
  connected = enabled;
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  btnImg.disabled = !enabled;
  if (enabled) messageInput.focus();
}

function setRoomTag(size, isPrivate = false) {
  if (isPrivate) {
    roomTag.textContent = "private";
    roomTag.classList.remove("hidden");
  } else if (size <= 2) {
    roomTag.classList.add("hidden");
  } else {
    roomTag.textContent = `${size}-person group`;
    roomTag.classList.remove("hidden");
  }
}

function showTypingIndicator(show) {
  typingIndicator.classList.toggle("hidden", !show);
  if (show) {
    // Use partner nickname if available
    const name = partnerNickname || "Stranger";
    if (typingLabel) typingLabel.textContent = `${name} is typing`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// ── Resolve display names ─────────────────────────────────────────────────────
function myLabel() { return myNickname || "You"; }
function strangerLabel() { return partnerNickname || "Stranger"; }

// ── Append message ────────────────────────────────────────────────────────────
function appendMessage(type, content, mode = "text") {
  if (emptyStateEl) emptyStateEl.style.display = "none";

  const msgEl = document.createElement("div");
  msgEl.className = `msg ${type}`;

  if (type === "system") {
    msgEl.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>`;

  } else if (mode === "image") {
    const label = type === "you" ? myLabel() : strangerLabel();
    msgEl.innerHTML = `
      <div class="msg-inner">
        <span class="msg-label">${escapeHtml(label)}</span>
        <div class="img-bubble" role="button" tabindex="0" aria-label="View image">
          <img src="${content}" alt="Shared image" loading="lazy" />
        </div>
      </div>`;
    const imgBubble = msgEl.querySelector(".img-bubble");
    imgBubble.addEventListener("click", () => openLightbox(content));
    imgBubble.addEventListener("keydown", e => e.key === "Enter" && openLightbox(content));

  } else if (mode === "igCard") {
    const handle = escapeHtml(content);
    const label = type === "you" ? `${myLabel()} shared` : `${strangerLabel()} shared`;
    msgEl.innerHTML = `
      <div class="msg-inner">
        <span class="msg-label">${label}</span>
        <a class="ig-card" href="https://instagram.com/${handle}" target="_blank" rel="noopener noreferrer">
          <div class="ig-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none"/>
            </svg>
          </div>
          <div class="ig-card-text">
            <span class="ig-card-name">@${handle}</span>
            <span class="ig-card-handle">Instagram · tap to open</span>
          </div>
        </a>
      </div>`;
  } else {
    const label = type === "you" ? myLabel() : strangerLabel();
    msgEl.innerHTML = `
      <div class="msg-inner">
        <span class="msg-label">${escapeHtml(label)}</span>
        <div class="bubble">${escapeHtml(content)}</div>
      </div>`;
  }

  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages() {
  [...messagesEl.children].forEach(el => { if (el.id !== "emptyState") el.remove(); });
  if (emptyStateEl) emptyStateEl.style.display = "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
}

function openLightbox(src) {
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `<img src="${src}" alt="Full size" />`;
  lb.addEventListener("click", () => lb.remove());
  document.body.appendChild(lb);
}

// ── Stats polling ─────────────────────────────────────────────────────────────
async function fetchStats() {
  try {
    const res = await fetch("/stats");
    if (!res.ok) return;
    const d = await res.json();
    const n = d.online ?? "—";
    if (onlineCount) onlineCount.textContent = n;
    if (onlineCountHome) onlineCountHome.textContent = n;
  } catch { /* ignore */ }
}
fetchStats();
setInterval(fetchStats, 10_000);

// ══════════════════════════════════════════════════════════════════════════════
// SOCKET EVENTS
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// SOCKET EVENTS
// ══════════════════════════════════════════════════════════════════════════════

// Stores what to do after socket connects + identify is sent
let pendingQueueJoin = null; // { size } or null

socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
  // Send identify FIRST so server maps userId before any other events
  socket.emit("identify", myUserId);
  // Flush pending queue join — emitted right after identify in the same flush
  // so server processes them in order (same socket, FIFO guaranteed)
  if (pendingQueueJoin) {
    const { size } = pendingQueueJoin;
    pendingQueueJoin = null;
    socket.emit("joinQueue", { size });
    if (myNickname) socket.emit("myNickname", myNickname);
  }
});

socket.on("waiting", ({ size }) => {
  setStatus("waiting", size > 2 ? `Waiting for ${size}-person group…` : "Finding a stranger…");
  setInputEnabled(false);
  showTypingIndicator(false);
  clearMessages();
  setRoomTag(0);
  partnerNickname = "";
  partnerUserId = "";   // NEW: reset partner tracking
});

socket.on("matched", ({ size, private: priv }) => {
  privateCreatedModal.classList.add("hidden");
  isPrivateRoom = !!priv;

  const stranger = strangerLabel();
  const label = priv
    ? "Connected privately!"
    : size > 2 ? `In a ${size}-person group!`
      : "Connected — say hi!";

  setStatus("connected", label);
  setInputEnabled(true);
  setRoomTag(size, isPrivateRoom);

  const sysmsg = priv
    ? "You're in a private room."
    : size > 2 ? `You're now in a ${size}-person group chat.`
      : `You're now chatting with ${stranger}.`;

  appendMessage("system", sysmsg);

  // Send our nickname to partner after matching
  if (myNickname) socket.emit("myNickname", myNickname);

  // Show report button — partnerUserId may arrive via separate event,
  // but reveal button now so it's ready. Button is gated on `connected`.
  showReportBtn();

  notifyUser("Strangr ⚡", priv ? "Your friend joined!" : size > 2 ? `Joined a ${size}-person group!` : "A stranger connected!");
});

// Receive partner's nickname
socket.on("partnerNickname", (name) => {
  if (typeof name === "string" && name.trim()) {
    partnerNickname = name.trim().slice(0, 20);
  }
});

socket.on("message", (text) => {
  appendMessage("them", text, "text");
});

socket.on("imageShare", (dataUrl) => {
  appendMessage("them", dataUrl, "image");
});

socket.on("igShare", (username) => {
  appendMessage("them", username, "igCard");
});

socket.on("typing", (isTyping) => {
  showTypingIndicator(isTyping);
});

socket.on("partnerLeft", () => {
  showTypingIndicator(false);
  const who = isPrivateRoom ? "Your friend" : strangerLabel();
  setStatus("left", `${who} disconnected`);
  setInputEnabled(false);
  appendMessage("system", `${who} has left the chat.`);
  isPrivateRoom = false;
  partnerNickname = "";
  partnerUserId = "";   // NEW
  hideReportBtn();         // NEW
});

// NEW: banned — server kicked us (we are banned)
socket.on("banned", ({ banType, retryAfter }) => {
  connected = false;
  setInputEnabled(false);
  const msg = banType === "perm"
    ? "You have been permanently banned from Strangr."
    : `You have been temporarily banned.${retryAfter ? ` Try again in ${Math.ceil(retryAfter / 60)} minute(s).` : ""}`;
  showToast(msg, "error", 8000);
  appendMessage("system", `⛔ ${msg}`);
  setTimeout(() => {
    socket.disconnect();
    showHome();
  }, 4000);
});

// NEW: flagWarning — our message was flagged (keywords)
socket.on("flagWarning", ({ message }) => {
  showToast(message, "warn", 5000);
});

// NEW: receive partner's userId (relayed by server on match)
socket.on("partnerUserId", (uid) => {
  if (typeof uid === "string" && uid.trim()) {
    partnerUserId = uid.trim();
    showReportBtn(); // show report button now that we have a target
  }
});

// NEW: report acknowledged
socket.on("reportAck", () => {
  showToast("Report submitted. Thank you.", "success");
});

socket.on("disconnect", () => {
  if (chatScreen.classList.contains("hidden")) return;
  setStatus("waiting", "Connection lost — reconnecting…");
  setInputEnabled(false);
});

socket.on("rateLimited", ({ action, retryAfter }) => {
  const msgs = {
    message: `Slow down! Wait ${retryAfter}s.`,
    skip: `Too many skips! Wait ${retryAfter}s.`,
    igShare: `IG limit. Wait ${retryAfter}s.`,
    imageShare: `Image limit. Wait ${retryAfter}s.`,
    joinQueue: `Queue limit. Wait ${retryAfter}s.`,
  };
  showToast(msgs[action] || `Rate limited. Retry in ${retryAfter}s.`, "warn");
});

// ══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ══════════════════════════════════════════════════════════════════════════════
function sendMessage() {
  if (pendingImg && connected) {
    sendPendingImage();
    stopTyping();
    return;
  }
  const text = messageInput.value.trim();
  if (!text || !connected) return;
  socket.emit("message", text);
  appendMessage("you", text, "text");
  messageInput.value = "";
  charCountEl.textContent = "0 / 500";
  charCountEl.classList.remove("warn");
  resizeInput();
  stopTyping();
}

function stopTyping() {
  clearTimeout(typingTimeout);
  if (isTypingEmitted) {
    socket.emit("typing", false);
    isTypingEmitted = false;
  }
}

sendBtn?.addEventListener("click", sendMessage);
messageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

let typingTimeout = null;
let isTypingEmitted = false;

messageInput?.addEventListener("input", () => {
  resizeInput();
  const len = messageInput.value.length;
  charCountEl.textContent = `${len} / 500`;
  charCountEl.classList.toggle("warn", len > 450);

  if (!connected) return;
  if (!isTypingEmitted) { socket.emit("typing", true); isTypingEmitted = true; }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("typing", false);
    isTypingEmitted = false;
  }, 1500);
});

// ── Report button visibility ───────────────────────────────────────────────────
function showReportBtn() {
  const btn = document.getElementById("btnReport");
  if (btn) btn.classList.remove("hidden");
}
function hideReportBtn() {
  const btn = document.getElementById("btnReport");
  if (btn) btn.classList.add("hidden");
}

// Report modal
const reportModal = document.getElementById("reportModal");
const btnReport = document.getElementById("btnReport");
const btnCloseReport = document.getElementById("btnCloseReport");

btnReport?.addEventListener("click", () => {
  if (!connected) { showToast("Connect to a stranger first.", "warn"); return; }
  reportModal?.classList.remove("hidden");
});

btnCloseReport?.addEventListener("click", () => reportModal?.classList.add("hidden"));
reportModal?.addEventListener("click", e => { if (e.target === reportModal) reportModal.classList.add("hidden"); });

document.querySelectorAll(".report-reason-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const reason = btn.dataset.reason;
    const target = partnerUserId || "unknown";
    socket.emit("reportUser", { targetUserId: target, reason });
    reportModal?.classList.add("hidden");
    hideReportBtn(); // one report per session
  });
});

skipBtn?.addEventListener("click", () => {
  socket.emit("skip", { size: roomSize });
  setStatus("waiting", isPrivateRoom ? "Returning…" : "Finding new stranger…");
  setInputEnabled(false);
  showTypingIndicator(false);
  stopTyping();
  clearMessages();
  clearPendingImg();
  setRoomTag(0);
  partnerNickname = "";
  partnerUserId = "";   // NEW
  hideReportBtn();         // NEW

  if (isPrivateRoom) {
    isPrivateRoom = false;
    socket.disconnect();
    connected = false;
    showHome();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// IMAGE SHARING — upload, paste, drag & drop
// ══════════════════════════════════════════════════════════════════════════════
const MAX_IMG_BYTES = 2 * 1024 * 1024; // 2 MB raw file limit
const MAX_IMG_DIM = 1200;             // max dimension for compression
const JPEG_QUALITY = 0.8;              // JPEG compression quality

// ── Compress image via canvas to keep data URL under socket.io buffer ────────
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Scale down if too large
      if (width > MAX_IMG_DIM || height > MAX_IMG_DIM) {
        const ratio = Math.min(MAX_IMG_DIM / width, MAX_IMG_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      // Use JPEG for photos (smaller), PNG for transparency
      const isPng = file.type === "image/png";
      const dataUrl = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", JPEG_QUALITY);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

// ── Process an image file (shared by upload, paste, drag) ────────────────────
async function processImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Only image files are supported.", "error");
    return;
  }
  if (file.size > MAX_IMG_BYTES * 2) {
    // Allow up to 4MB raw since we'll compress it
    showToast("Image too large. Max 4 MB.", "error");
    return;
  }
  try {
    const dataUrl = await compressImage(file);
    // Check compressed size (base64 data after comma)
    const base64Part = dataUrl.split(",")[1] || "";
    const compressedBytes = Math.ceil((base64Part.length * 3) / 4);
    if (compressedBytes > MAX_IMG_BYTES) {
      showToast("Image still too large after compression. Try a smaller image.", "error");
      return;
    }
    pendingImg = dataUrl;
    showImgPreview(dataUrl);
    showToast("Image ready — press Enter or Send to share.", "success", 2500);
  } catch {
    showToast("Failed to process image.", "error");
  }
}

// ── Image button — click to upload ───────────────────────────────────────────
btnImg?.addEventListener("click", () => {
  if (!connected) return;
  imageInput.value = "";
  imageInput.click();
});

imageInput?.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (file) processImageFile(file);
});

// ── Preview ──────────────────────────────────────────────────────────────────
function showImgPreview(dataUrl) {
  clearPendingImg(true);
  const wrap = document.createElement("div");
  wrap.className = "img-preview-wrap";
  wrap.id = "imgPreviewWrap";

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "preview";

  const clearBtn = document.createElement("button");
  clearBtn.className = "img-preview-clear";
  clearBtn.setAttribute("aria-label", "Cancel");
  clearBtn.textContent = "✕";
  clearBtn.addEventListener("click", () => clearPendingImg(true));

  wrap.appendChild(img);
  wrap.appendChild(clearBtn);
  imgPreviewSlot.appendChild(wrap);
}

// ── Send ─────────────────────────────────────────────────────────────────────
function sendPendingImage() {
  if (!pendingImg || !connected) return;
  socket.emit("imageShare", pendingImg);
  appendMessage("you", pendingImg, "image");
  clearPendingImg(true);
}

function clearPendingImg(removePreview = true) {
  pendingImg = null;
  if (removePreview) document.getElementById("imgPreviewWrap")?.remove();
}

// ── Paste support ────────────────────────────────────────────────────────────
document.addEventListener("paste", (e) => {
  if (!connected) return;
  // Only handle paste when chat screen is visible
  if (chatScreen?.classList.contains("hidden")) return;
  const items = Array.from(e.clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith("image/"));
  if (!imageItem) return;
  e.preventDefault();
  const file = imageItem.getAsFile();
  if (file) processImageFile(file);
});

// ── Drag & Drop support on the chat area ─────────────────────────────────────
(function initDragDrop() {
  const dropTarget = document.getElementById("messages");
  if (!dropTarget) return;

  let dragCounter = 0;

  // Create drop zone overlay
  const dropOverlay = document.createElement("div");
  dropOverlay.className = "drop-overlay";
  dropOverlay.innerHTML = `
    <div class="drop-overlay-content">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
      <span>Drop image to share</span>
    </div>
  `;
  dropTarget.style.position = "relative";
  dropTarget.appendChild(dropOverlay);

  dropTarget.addEventListener("dragenter", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (!connected) return;
    if (e.dataTransfer?.types?.includes("Files")) {
      dropOverlay.classList.add("active");
    }
  });

  dropTarget.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  dropTarget.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.remove("active");
    }
  });

  dropTarget.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropOverlay.classList.remove("active");
    if (!connected) { showToast("Connect to a stranger first.", "warn"); return; }
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file);
    }
  });
})();

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM
// ══════════════════════════════════════════════════════════════════════════════
function openIgModal() {
  igInput.value = myIgHandle || "";
  igModal.classList.remove("hidden");
  setTimeout(() => igInput.focus(), 50);
}
function closeIgModal() { igModal.classList.add("hidden"); }

function saveIgHandle() {
  const raw = igInput.value.trim().replace(/^@/, "");
  if (!raw) { igInput.focus(); return; }
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(raw)) {
    showToast("Invalid username. Letters, numbers, _ and . only.", "error"); return;
  }
  myIgHandle = raw;
  btnIgAdd.classList.add("hidden");
  btnIgShare.classList.remove("hidden");
  closeIgModal();
  showToast("Instagram saved! Tap the IG button to share.", "success");
}

function sendIgShare() {
  if (!myIgHandle || !connected) return;
  socket.emit("igShare", myIgHandle);
  appendMessage("you", myIgHandle, "igCard");
}

btnIgAdd?.addEventListener("click", openIgModal);
btnIgShare?.addEventListener("click", sendIgShare);
igModalClose?.addEventListener("click", closeIgModal);
igModalCancel?.addEventListener("click", closeIgModal);
igModalSave?.addEventListener("click", saveIgHandle);
igInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveIgHandle(); }
  if (e.key === "Escape") closeIgModal();
});
igModal?.addEventListener("click", (e) => { if (e.target === igModal) closeIgModal(); });

// ══════════════════════════════════════════════════════════════════════════════
// LEGAL MODAL
// ══════════════════════════════════════════════════════════════════════════════
const LEGAL_CONTENT = {
  guidelines: {
    html: `
<h2>Community Guidelines</h2>
<p>Strangr is built for safe, respectful, and meaningful interactions.</p>
<hr/>
<h3>1. Respect Others</h3>
<ul><li>No harassment, bullying, or hate speech</li><li>No threats or intimidation</li></ul>
<h3>2. No Explicit or Illegal Content</h3>
<ul><li>No sexual content or nudity</li><li>No illegal discussions or activities</li></ul>
<h3>3. No Spam or Scams</h3>
<ul><li>No repetitive or unwanted messages</li><li>No promotions, ads, or phishing</li></ul>
<h3>4. No Impersonation</h3>
<ul><li>Do not pretend to be someone else</li></ul>
<h3>5. Protect Privacy</h3>
<ul><li>Do not share or request personal information</li></ul>
<h3>6. Consequences</h3>
<p>Violations may result in warning, temporary ban, or permanent ban.</p>` },
  privacy: {
    html: `
<h2>Privacy Policy</h2>
<p><strong>Effective Date:</strong> April 3, 2026</p>
<hr/>
<h3>1. Information We Collect</h3>
<p>We may collect IP address, device/browser info, and usage activity. We do <strong>not</strong> require personal identity.</p>
<h3>2. How We Use It</h3>
<ul><li>Operate the platform</li><li>Detect abuse and enforce rules</li></ul>
<h3>3. Data Storage</h3>
<p>Data stored securely. No chats are saved after disconnect.</p>
<h3>4. Sharing</h3>
<p>We do <strong>not</strong> sell data. May share only if required by law.</p>
<h3>5. Changes</h3>
<p>Policy may update. Continued use = acceptance.</p>` },
  terms: {
    html: `
<h2>Terms and Conditions</h2>
<p><strong>Effective Date:</strong> April 3, 2026</p>
<hr/>
<h3>1. Use of Service</h3>
<p>You must be at least <strong>13 years old</strong>. Use the platform responsibly and lawfully.</p>
<h3>2. Prohibited Conduct</h3>
<ul>
  <li>Harassment, abuse, threats</li><li>Illegal or explicit content</li>
  <li>Impersonation or deception</li><li>Spam or exploitation</li>
</ul>
<h3>3. Liability</h3>
<p>Strangr is provided "as is." We are not liable for user behavior or data loss.</p>
<h3>4. Termination</h3>
<p>We may restrict or ban accounts without notice.</p>` }
};

let activeLegalTab = "guidelines";

function openLegalModal(tab = "guidelines") {
  activeLegalTab = tab;
  renderLegalContent(tab);
  legalModal.classList.remove("hidden");
}
function closeLegalModal() { legalModal.classList.add("hidden"); }
function renderLegalContent(tab) {
  legalBody.innerHTML = LEGAL_CONTENT[tab]?.html || "";
  document.querySelectorAll(".legal-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
}

document.querySelectorAll(".legal-link").forEach(btn => {
  btn.addEventListener("click", () => openLegalModal(btn.dataset.tab));
});
document.querySelectorAll(".legal-tab").forEach(tab => {
  tab.addEventListener("click", () => { activeLegalTab = tab.dataset.tab; renderLegalContent(activeLegalTab); });
});
legalModalClose?.addEventListener("click", closeLegalModal);
legalModal?.addEventListener("click", (e) => { if (e.target === legalModal) closeLegalModal(); });

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
showHome();

// ── Fetch site config (support email from env) ────────────────────────────────
(async function loadSiteConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg.supportEmail) {
      const emailBtn = document.querySelector(".support-email-btn");
      if (emailBtn) {
        emailBtn.href = `mailto:${cfg.supportEmail}`;
        // Update the text node (keep the SVG icon)
        const textNodes = [...emailBtn.childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
        if (textNodes.length) {
          textNodes[textNodes.length - 1].textContent = ` ${cfg.supportEmail}`;
        } else {
          emailBtn.append(` ${cfg.supportEmail}`);
        }
      }
    }
  } catch { /* fallback to hardcoded email in HTML */ }
})();

// ══════════════════════════════════════════════════════════════════════════════
// DOODLE ENGINE
// Handles: desktop left/right panels + mobile doodle screen
// Architecture: one shared brush state, two canvas pairs (desktop + mobile)
// Strokes are batched into segments and emitted via socket.emit("drawStroke")
// Incoming strokes are replayed on the partner canvas
// Changing settings only affects NEW strokes — past draws are untouched
// ══════════════════════════════════════════════════════════════════════════════

// ── Brush state (single source of truth for both desktop + mobile) ────────────
const brush = {
  type: "round",   // round | square | spray | eraser
  size: 6,
  color: "#6c4ff7",
  opacity: 1.0,
  glow: false,
  shadow: false,
};

// ── Canvas references ─────────────────────────────────────────────────────────
const myCanvasD = document.getElementById("myCanvas");          // desktop my
const partnerCanvasD = document.getElementById("partnerCanvas");     // desktop partner
const myCanvasM = document.getElementById("myCanvasMobile");    // mobile my
const partnerCanvasM = document.getElementById("partnerCanvasMobile");// mobile partner

// ── Drawing state ─────────────────────────────────────────────────────────────
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let strokePoints = [];   // buffer current stroke for batched emit
let emitTimer = null;

// ── Helpers: get CSS variable resolved value ──────────────────────────────────
function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Canvas background = site background colour (theme-aware)
function canvasBg() {
  return getComputedStyle(document.documentElement).getPropertyValue("--bg-card").trim() || "#ffffff";
}

// ── Resize canvas to match its CSS display size ───────────────────────────────
function resizeCanvas(canvas) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  // Save existing drawing
  const imgData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.putImageData(imgData, 0, 0);
}

function initCanvas(canvas) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  fillCanvasBg(canvas);
}

function fillCanvasBg(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = canvasBg();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// Reinit all canvases when theme changes or screen resizes
function reinitAllCanvases() {
  [myCanvasD, partnerCanvasD, myCanvasM, partnerCanvasM].forEach(initCanvas);
}

// ── Apply brush effects to a context ─────────────────────────────────────────
function applyEffects(ctx, color, size) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";

  if (brush.glow && brush.type !== "eraser") {
    ctx.shadowBlur = size * 3;
    ctx.shadowColor = color;
  }
  if (brush.shadow && !brush.glow && brush.type !== "eraser") {
    ctx.shadowBlur = size * 1.5;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowOffsetX = size * 0.5;
    ctx.shadowOffsetY = size * 0.5;
  }
}

// ── Draw a single segment on a canvas ─────────────────────────────────────────
// strokeData: { x1, y1, x2, y2, color, size, brushType, opacity, glow, shadow }
function renderSegment(canvas, seg) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.globalAlpha = seg.opacity ?? 1;

  if (seg.brushType === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(seg.x2, seg.y2, (seg.size ?? 10) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = seg.color;
  ctx.fillStyle = seg.color;
  ctx.lineCap = seg.brushType === "square" ? "square" : "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = seg.size ?? 6;

  // Apply glow / shadow
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  if (seg.glow) {
    ctx.shadowBlur = (seg.size ?? 6) * 3;
    ctx.shadowColor = seg.color;
  } else if (seg.shadow) {
    ctx.shadowBlur = (seg.size ?? 6) * 1.5;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowOffsetX = (seg.size ?? 6) * 0.5;
    ctx.shadowOffsetY = (seg.size ?? 6) * 0.5;
  }

  if (seg.brushType === "spray") {
    // Spray: random dots around the point
    const density = Math.max(6, (seg.size ?? 6) * 2);
    const radius = (seg.size ?? 6) * 1.8;
    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const sx = seg.x2 + Math.cos(angle) * r;
      const sy = seg.y2 + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Get normalised coords from pointer/touch event ────────────────────────────
function getCoords(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top,
  };
}

// ── Emit buffered stroke to server ────────────────────────────────────────────
function flushStroke() {
  if (strokePoints.length < 1) return;
  socket.emit("drawStroke", {
    points: strokePoints,
    color: brush.type === "eraser" ? "#transparent" : brush.color,
    size: brush.size,
    brushType: brush.type,
    opacity: brush.opacity,
    glow: brush.glow,
    shadow: brush.shadow,
  });
  strokePoints = [];
}

// ── Draw handler (works for both desktop + mobile canvases) ───────────────────
function onDrawStart(canvas, e) {
  e.preventDefault();
  isDrawing = true;
  const { x, y } = getCoords(canvas, e);
  lastX = x; lastY = y;
  strokePoints = [{ x1: x, y1: y, x2: x, y2: y }];

  // Auto-retract toolbar while drawing
  const panel = canvas.closest(".draw-panel-left, .doodle-pane-top");
  if (panel) panel.classList.add("drawing");
}

function onDrawMove(canvas, e) {
  if (!isDrawing) return;
  e.preventDefault();
  const { x, y } = getCoords(canvas, e);

  const seg = {
    x1: lastX, y1: lastY, x2: x, y2: y,
    color: brush.type === "eraser" ? null : brush.color,
    size: brush.size,
    brushType: brush.type,
    opacity: brush.opacity,
    glow: brush.glow,
    shadow: brush.shadow,
  };

  renderSegment(canvas, seg);
  strokePoints.push({ x1: lastX, y1: lastY, x2: x, y2: y });
  lastX = x; lastY = y;

  // Batch emit every 50ms
  if (!emitTimer) {
    emitTimer = setTimeout(() => {
      flushStroke();
      emitTimer = null;
    }, 50);
  }
}

function onDrawEnd(canvas) {
  if (!isDrawing) return;
  isDrawing = false;
  clearTimeout(emitTimer);
  emitTimer = null;
  flushStroke();

  const panel = canvas.closest(".draw-panel-left, .doodle-pane-top");
  if (panel) {
    setTimeout(() => panel.classList.remove("drawing"), 1200);
  }
}

// ── Attach draw listeners to a canvas ────────────────────────────────────────
function attachDrawListeners(canvas) {
  if (!canvas) return;
  canvas.addEventListener("mousedown", e => onDrawStart(canvas, e));
  canvas.addEventListener("mousemove", e => onDrawMove(canvas, e));
  canvas.addEventListener("mouseup", () => onDrawEnd(canvas));
  canvas.addEventListener("mouseleave", () => onDrawEnd(canvas));
  canvas.addEventListener("touchstart", e => onDrawStart(canvas, e), { passive: false });
  canvas.addEventListener("touchmove", e => onDrawMove(canvas, e), { passive: false });
  canvas.addEventListener("touchend", () => onDrawEnd(canvas));
}

// ── Incoming draw stroke from partner ────────────────────────────────────────
function replayStroke(data, canvas) {
  if (!canvas || !data?.points) return;
  // Hide the empty placeholder once drawing arrives
  const emptyEl = canvas.closest(".draw-panel, .doodle-pane")?.querySelector(".draw-panel-empty");
  if (emptyEl) emptyEl.classList.add("hidden");

  for (const pt of data.points) {
    renderSegment(canvas, {
      x1: pt.x1, y1: pt.y1, x2: pt.x2, y2: pt.y2,
      color: data.color,
      size: data.size,
      brushType: data.brushType,
      opacity: data.opacity,
      glow: data.glow,
      shadow: data.shadow,
    });
  }
}

// ── Socket draw events ────────────────────────────────────────────────────────
socket.on("drawStroke", (data) => {
  replayStroke(data, partnerCanvasD);
  replayStroke(data, partnerCanvasM);
});

socket.on("clearCanvas", () => {
  [partnerCanvasD, partnerCanvasM].forEach(c => {
    if (!c) return;
    fillCanvasBg(c);
    // Show empty placeholder again
    const emptyEl = c.closest(".draw-panel, .doodle-pane")?.querySelector(".draw-panel-empty");
    if (emptyEl) emptyEl.classList.remove("hidden");
  });
});

// ── Clear own canvas ─────────────────────────────────────────────────────────
function clearMyCanvas() {
  [myCanvasD, myCanvasM].forEach(c => { if (c) fillCanvasBg(c); });
  socket.emit("clearCanvas");
}
document.getElementById("btnClearCanvas")?.addEventListener("click", clearMyCanvas);
document.getElementById("btnClearMobile")?.addEventListener("click", clearMyCanvas);

// ── Also clear partner canvases when a new match starts ───────────────────────
// (hook into existing socket.on("matched") by extending it after the fact)
const _origMatchedHandler = null; // socket.on already registered above
// We add a second listener — Socket.IO supports multiple listeners per event
socket.on("matched", () => {
  [myCanvasD, partnerCanvasD, myCanvasM, partnerCanvasM].forEach(c => {
    if (!c) return;
    fillCanvasBg(c);
  });
  // Restore empty placeholder on partner panels
  document.querySelectorAll(".draw-panel-empty").forEach(el => el.classList.remove("hidden"));
});

// ── Toolbar wiring — DESKTOP ──────────────────────────────────────────────────
const drawToolbarD = document.getElementById("drawToolbar");
const toolbarToggleD = document.getElementById("drawToolbarToggle");

// Make toolbar floating on open
toolbarToggleD?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (drawToolbarD) {
    const isHidden = drawToolbarD.classList.contains("hidden");
    if (isHidden) {
      drawToolbarD.classList.remove("hidden");
      drawToolbarD.classList.add("floating");
      // Position near the toggle button if not already positioned by drag
      if (!drawToolbarD.dataset.dragged) {
        const panel = document.getElementById("drawPanelLeft");
        if (panel) {
          const rect = panel.getBoundingClientRect();
          drawToolbarD.style.left = (rect.right + 8) + "px";
          drawToolbarD.style.top = (rect.top + 40) + "px";
        }
      }
    } else {
      drawToolbarD.classList.add("hidden");
      drawToolbarD.classList.remove("floating");
    }
  }
});

// Close toolbar when clicking outside (but not when clicking inside it)
document.addEventListener("click", (e) => {
  if (drawToolbarD && !drawToolbarD.classList.contains("hidden") &&
    !drawToolbarD.contains(e.target) && e.target !== toolbarToggleD &&
    !toolbarToggleD?.contains(e.target)) {
    drawToolbarD.classList.add("hidden");
    drawToolbarD.classList.remove("floating");
  }
});

// ── Draggable Drawing Toolbar ────────────────────────────────────────────────
(function initDraggableToolbar() {
  const toolbar = document.getElementById("drawToolbar");
  const handle = document.getElementById("dtDragHandle");
  if (!toolbar || !handle) return;

  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag, { passive: false });

  function startDrag(e) {
    // Only if toolbar is floating
    if (!toolbar.classList.contains("floating")) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    document.body.classList.add("toolbar-dragging");

    const src = e.touches ? e.touches[0] : e;
    const rect = toolbar.getBoundingClientRect();
    offsetX = src.clientX - rect.left;
    offsetY = src.clientY - rect.top;

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchmove", onDrag, { passive: false });
    document.addEventListener("touchend", endDrag);
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const src = e.touches ? e.touches[0] : e;
    let newX = src.clientX - offsetX;
    let newY = src.clientY - offsetY;

    // Clamp to viewport
    const maxX = window.innerWidth - toolbar.offsetWidth;
    const maxY = window.innerHeight - 40; // keep at least handle visible
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    toolbar.style.left = newX + "px";
    toolbar.style.top = newY + "px";
    toolbar.dataset.dragged = "true";
  }

  function endDrag() {
    isDragging = false;
    document.body.classList.remove("toolbar-dragging");
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", endDrag);
    document.removeEventListener("touchmove", onDrag);
    document.removeEventListener("touchend", endDrag);
  }
})();

// Sync brush type buttons — desktop
document.querySelectorAll("[data-brush]").forEach(btn => {
  btn.addEventListener("click", () => {
    brush.type = btn.dataset.brush;
    document.querySelectorAll("[data-brush]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    // Also sync mobile buttons
    document.querySelectorAll(`[data-brush-m="${brush.type}"]`).forEach(b => {
      document.querySelectorAll("[data-brush-m]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    });
  });
});

// Brush size
const brushSizeSlider = document.getElementById("brushSize");
const brushSizeVal = document.getElementById("brushSizeVal");
brushSizeSlider?.addEventListener("input", () => {
  brush.size = Number(brushSizeSlider.value);
  if (brushSizeVal) brushSizeVal.textContent = brush.size;
  // Sync mobile
  const m = document.getElementById("brushSizeMobile");
  if (m) m.value = brush.size;
});

// Brush colour
const brushColorInput = document.getElementById("brushColor");
brushColorInput?.addEventListener("input", () => {
  brush.color = brushColorInput.value;
  const m = document.getElementById("brushColorMobile");
  if (m) m.value = brush.color;
});

// Swatches
document.querySelectorAll(".dt-swatch").forEach(btn => {
  btn.addEventListener("click", () => {
    brush.color = btn.dataset.color;
    if (brushColorInput) brushColorInput.value = brush.color;
    const m = document.getElementById("brushColorMobile");
    if (m) m.value = brush.color;
    document.querySelectorAll(".dt-swatch").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Opacity
const brushOpacitySlider = document.getElementById("brushOpacity");
const brushOpacityVal = document.getElementById("brushOpacityVal");
brushOpacitySlider?.addEventListener("input", () => {
  brush.opacity = Number(brushOpacitySlider.value) / 100;
  if (brushOpacityVal) brushOpacityVal.textContent = brushOpacitySlider.value;
});

// Effects — desktop
document.getElementById("effectGlow")?.addEventListener("change", e => {
  brush.glow = e.target.checked;
  const m = document.getElementById("effectGlowMobile");
  if (m) m.checked = brush.glow;
});
document.getElementById("effectShadow")?.addEventListener("change", e => {
  brush.shadow = e.target.checked;
  const m = document.getElementById("effectShadowMobile");
  if (m) m.checked = brush.shadow;
});

// ── Toolbar wiring — MOBILE ───────────────────────────────────────────────────
const drawToolbarM = document.getElementById("drawToolbarMobile");
const toolbarToggleM = document.getElementById("drawToolbarToggleMobile");

toolbarToggleM?.addEventListener("click", (e) => {
  e.stopPropagation();
  drawToolbarM?.classList.toggle("hidden");
});

// Mobile brush type
document.querySelectorAll("[data-brush-m]").forEach(btn => {
  btn.addEventListener("click", () => {
    brush.type = btn.dataset.brushM;
    document.querySelectorAll("[data-brush-m]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    // Sync desktop
    document.querySelectorAll(`[data-brush="${brush.type}"]`).forEach(b => {
      document.querySelectorAll("[data-brush]").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    });
  });
});

// Mobile size
document.getElementById("brushSizeMobile")?.addEventListener("input", e => {
  brush.size = Number(e.target.value);
  if (brushSizeSlider) brushSizeSlider.value = brush.size;
  if (brushSizeVal) brushSizeVal.textContent = brush.size;
});

// Mobile colour
document.getElementById("brushColorMobile")?.addEventListener("input", e => {
  brush.color = e.target.value;
  if (brushColorInput) brushColorInput.value = brush.color;
});

// Mobile effects
document.getElementById("effectGlowMobile")?.addEventListener("change", e => {
  brush.glow = e.target.checked;
  const d = document.getElementById("effectGlow");
  if (d) d.checked = brush.glow;
});
document.getElementById("effectShadowMobile")?.addEventListener("change", e => {
  brush.shadow = e.target.checked;
  const d = document.getElementById("effectShadow");
  if (d) d.checked = brush.shadow;
});

// ── Mobile doodle screen navigation ──────────────────────────────────────────
const doodleScreen = document.getElementById("doodleScreen");

document.getElementById("btnDoodle")?.addEventListener("click", () => {
  doodleScreen?.classList.remove("hidden");
  chatScreen?.classList.add("hidden");
  // Init mobile canvases on first open
  setTimeout(() => {
    initCanvas(myCanvasM);
    initCanvas(partnerCanvasM);
    attachDrawListeners(myCanvasM);
  }, 50);
});

document.getElementById("btnDoodleBack")?.addEventListener("click", () => {
  doodleScreen?.classList.add("hidden");
  chatScreen?.classList.remove("hidden");
  // Clear canvases when leaving doodle screen (drawings cleared, chat kept)
  [myCanvasM, partnerCanvasM].forEach(fillCanvasBg);
  // Don't emit clearCanvas — only MY side clears locally on back
});

// ── Init desktop canvases on load ────────────────────────────────────────────
function initDesktopDoodle() {
  initCanvas(myCanvasD);
  initCanvas(partnerCanvasD);
  attachDrawListeners(myCanvasD);
  // Start toolbar hidden
  drawToolbarD?.classList.add("hidden");
  drawToolbarD?.classList.remove("floating");
}

// Reinit on resize (canvas dimensions must match layout)
let resizeDebounce;
window.addEventListener("resize", () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(reinitAllCanvases, 200);
});

// Run when chat screen becomes visible
const chatScreenObserver = new MutationObserver(() => {
  if (!chatScreen?.classList.contains("hidden")) {
    requestAnimationFrame(initDesktopDoodle);
  }
});
if (chatScreen) chatScreenObserver.observe(chatScreen, { attributes: true, attributeFilter: ["class"] });

// ══════════════════════════════════════════════════════════════════════════════
// SASH / SPLIT BAR — Resizable Panels
// Allows dragging sash dividers to resize the left drawing panel, center chat,
// and right drawing panel in the 3-column chat layout.
// ══════════════════════════════════════════════════════════════════════════════
(function initSashResize() {
  const sashLeft = document.getElementById("sashLeft");
  const sashRight = document.getElementById("sashRight");
  const panelLeft = document.getElementById("drawPanelLeft");
  const panelRight = document.getElementById("drawPanelRight");
  const chatApp = document.getElementById("chatApp");
  const chatLayout = panelLeft?.parentElement;

  if (!sashLeft || !sashRight || !panelLeft || !panelRight || !chatApp || !chatLayout) return;

  const MIN_PANEL = 150;     // minimum panel width in px
  const MIN_CHAT = 320;     // minimum chat width in px

  let activeSash = null;
  let startX = 0;
  let startLeftW = 0;
  let startRightW = 0;

  function onSashDown(sashId, e) {
    e.preventDefault();
    activeSash = sashId;
    const src = e.touches ? e.touches[0] : e;
    startX = src.clientX;
    startLeftW = panelLeft.getBoundingClientRect().width;
    startRightW = panelRight.getBoundingClientRect().width;

    document.body.classList.add("sash-dragging");
    document.getElementById(sashId)?.classList.add("active");

    // Switch panels to pixel widths (remove flex basis)
    panelLeft.style.flex = `0 0 ${startLeftW}px`;
    panelRight.style.flex = `0 0 ${startRightW}px`;

    document.addEventListener("mousemove", onSashMove);
    document.addEventListener("mouseup", onSashUp);
    document.addEventListener("touchmove", onSashMove, { passive: false });
    document.addEventListener("touchend", onSashUp);
  }

  function onSashMove(e) {
    if (!activeSash) return;
    e.preventDefault();
    const src = e.touches ? e.touches[0] : e;
    const dx = src.clientX - startX;
    const layoutW = chatLayout.getBoundingClientRect().width;
    const sashTotalW = 12; // two sashes × 6px

    if (activeSash === "sashLeft") {
      // Dragging left sash: resize left panel
      let newLeftW = startLeftW + dx;
      const maxLeft = layoutW - startRightW - MIN_CHAT - sashTotalW;
      newLeftW = Math.max(MIN_PANEL, Math.min(newLeftW, maxLeft));
      panelLeft.style.flex = `0 0 ${newLeftW}px`;
    } else {
      // Dragging right sash: resize right panel
      let newRightW = startRightW - dx;
      const maxRight = layoutW - startLeftW - MIN_CHAT - sashTotalW;
      newRightW = Math.max(MIN_PANEL, Math.min(newRightW, maxRight));
      panelRight.style.flex = `0 0 ${newRightW}px`;
    }

    // Reinit canvases after layout change
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      reinitAllCanvases();
    }, 100);
  }

  function onSashUp() {
    if (!activeSash) return;
    document.getElementById(activeSash)?.classList.remove("active");
    activeSash = null;
    document.body.classList.remove("sash-dragging");
    document.removeEventListener("mousemove", onSashMove);
    document.removeEventListener("mouseup", onSashUp);
    document.removeEventListener("touchmove", onSashMove);
    document.removeEventListener("touchend", onSashUp);

    // Final canvas reinit
    reinitAllCanvases();
  }

  // Attach listeners
  sashLeft.addEventListener("mousedown", e => onSashDown("sashLeft", e));
  sashLeft.addEventListener("touchstart", e => onSashDown("sashLeft", e), { passive: false });
  sashRight.addEventListener("mousedown", e => onSashDown("sashRight", e));
  sashRight.addEventListener("touchstart", e => onSashDown("sashRight", e), { passive: false });
})();

