/* ── Strangr v5 — client script ─────────────────────────────────────────────── */
"use strict";

// ══════════════════════════════════════════════════════════════════════════════
// DOM REFS
// ══════════════════════════════════════════════════════════════════════════════

// Screens
const homeScreen  = document.getElementById("homeScreen");
const chatScreen  = document.getElementById("chatScreen");

// Home
const btnStart          = document.getElementById("btnStart");
const btnBack           = document.getElementById("btnBack");
const nicknameInput     = document.getElementById("nicknameInput");
const onlineCountHome   = document.getElementById("onlineCountHome");
const btnShowPrivate    = document.getElementById("btnShowPrivate");
const privatePanel      = document.getElementById("privatePanel");
const privateCodeInput  = document.getElementById("privateCodeInput");
const btnJoinPrivate    = document.getElementById("btnJoinPrivate");
const btnCreatePrivate  = document.getElementById("btnCreatePrivate");

// Chat
const messagesEl        = document.getElementById("messages");
const emptyStateEl      = document.getElementById("emptyState");
const statusDot         = document.getElementById("statusDot");
const statusText        = document.getElementById("statusText");
const roomTag           = document.getElementById("roomTag");
const messageInput      = document.getElementById("messageInput");
const sendBtn           = document.getElementById("sendBtn");
const skipBtn           = document.getElementById("skipBtn");
const charCountEl       = document.getElementById("charCount");
const onlineCount       = document.getElementById("onlineCount");
const typingIndicator   = document.getElementById("typingIndicator");
const typingLabel       = document.getElementById("typingLabel");

// Image
const btnImg        = document.getElementById("btnImg");
const imageInput    = document.getElementById("imageInput");
const imgPreviewSlot = document.getElementById("imgPreviewSlot");

// Instagram
const igModal       = document.getElementById("igModal");
const igInput       = document.getElementById("igInput");
const igModalClose  = document.getElementById("igModalClose");
const igModalCancel = document.getElementById("igModalCancel");
const igModalSave   = document.getElementById("igModalSave");
const btnIgAdd      = document.getElementById("btnIgAdd");
const btnIgShare    = document.getElementById("btnIgShare");

// Private room modal
const privateCreatedModal = document.getElementById("privateCreatedModal");
const privateCreatedClose = document.getElementById("privateCreatedClose");
const privateCodeDisplay  = document.getElementById("privateCodeDisplay");
const btnCopyCode         = document.getElementById("btnCopyCode");

// Legal
const legalModal      = document.getElementById("legalModal");
const legalModalClose = document.getElementById("legalModalClose");
const legalBody       = document.getElementById("legalBody");

// Nav more
const btnNavMore   = document.getElementById("btnNavMore");
const navDropdown  = document.getElementById("navDropdown");
const themeToggle  = document.getElementById("themeToggle");
const themeLabel   = document.getElementById("themeLabel");
const mainNav      = document.getElementById("mainNav");

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
let connected     = false;
let roomSize      = 2;
let isPrivateRoom = false;
let myIgHandle    = null;
let pendingImg    = null;

// Nickname — my own + partner's
let myNickname      = "";  // set from input
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
  partnerUserId   = "";

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
  connected       = false;
  isPrivateRoom   = false;
  partnerNickname = "";
  partnerUserId   = "";   // NEW
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
function myLabel()      { return myNickname      || "You"; }
function strangerLabel(){ return partnerNickname || "Stranger"; }

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
    if (onlineCount)     onlineCount.textContent     = n;
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
  partnerUserId   = "";   // NEW: reset partner tracking
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
  isPrivateRoom   = false;
  partnerNickname = "";
  partnerUserId   = "";   // NEW
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
    message:   `Slow down! Wait ${retryAfter}s.`,
    skip:      `Too many skips! Wait ${retryAfter}s.`,
    igShare:   `IG limit. Wait ${retryAfter}s.`,
    imageShare:`Image limit. Wait ${retryAfter}s.`,
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
const reportModal   = document.getElementById("reportModal");
const btnReport     = document.getElementById("btnReport");
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
  partnerUserId   = "";   // NEW
  hideReportBtn();         // NEW

  if (isPrivateRoom) {
    isPrivateRoom = false;
    socket.disconnect();
    connected = false;
    showHome();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// IMAGE SHARING
// ══════════════════════════════════════════════════════════════════════════════
const MAX_IMG_BYTES = 2 * 1024 * 1024;

btnImg?.addEventListener("click", () => {
  if (!connected) return;
  imageInput.value = "";
  imageInput.click();
});

imageInput?.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Only image files are supported.", "error"); return; }
  if (file.size > MAX_IMG_BYTES) { showToast("Image too large. Max 2 MB.", "error"); return; }
  const reader = new FileReader();
  reader.onload = (e) => { pendingImg = e.target.result; showImgPreview(pendingImg); };
  reader.readAsDataURL(file);
});

function showImgPreview(dataUrl) {
  clearPendingImg(true);
  const wrap = document.createElement("div");
  wrap.className = "img-preview-wrap";
  wrap.id = "imgPreviewWrap";
  wrap.innerHTML = `<img src="${dataUrl}" alt="preview" /><button class="img-preview-clear" id="imgPreviewClear" aria-label="Cancel">✕</button>`;
  imgPreviewSlot.appendChild(wrap);
  document.getElementById("imgPreviewClear")?.addEventListener("click", () => clearPendingImg(true));
}

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

// Paste support
document.addEventListener("paste", (e) => {
  if (!connected) return;
  const items = Array.from(e.clipboardData?.items || []);
  const imageItem = items.find(item => item.type.startsWith("image/"));
  if (!imageItem) return;
  e.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return;
  if (file.size > MAX_IMG_BYTES) { showToast("Pasted image too large. Max 2 MB.", "error"); return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingImg = ev.target.result;
    showImgPreview(pendingImg);
    showToast("Image ready — press Enter or Send to share.", "success", 2500);
  };
  reader.readAsDataURL(file);
});

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
  guidelines: { html: `
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
  privacy: { html: `
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
  terms: { html: `
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

// ── Support email button (avoids Cloudflare obfuscation) ─────────────────────
document.getElementById("btnSupportEmail")?.addEventListener("click", () => {
  // Build mailto in JS so Cloudflare never sees a plain email in HTML
  const u = "support", d = "strangr.app";
  window.location.href = `mailto:${u}@${d}`;
});

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
showHome();

// ══════════════════════════════════════════════════════════════════════════════
// QUESTION BAR MODULE
// Self-contained — reads from existing sendMessage(), skipBtn, socket events.
// No modifications to any existing code above.
// ══════════════════════════════════════════════════════════════════════════════
(function QuestionBar() {

  // ── Question definitions ──────────────────────────────────────────────────
  // choices: optional array → receiver sees clickable inline answers
  const QUESTIONS = [
    { text: "Name?"                         },
    { text: "Male or Female?",   choices: ["Male", "Female"]         },
    { text: "Age?"                          },
    { text: "From?"                         },
    { text: "What do you do?"               },
    { text: "Student or working?", choices: ["Student", "Working"]   },
    { text: "What's your vibe?"             },
    { text: "What are you doing right now?" },
    { text: "Why are you here?"             },
    { text: "Single or taken?",  choices: ["Single", "Taken"]        },
  ];

  // Questions that have choice answers — keyed by text for quick lookup
  const CHOICE_MAP = {};
  QUESTIONS.forEach(q => { if (q.choices) CHOICE_MAP[q.text] = q.choices; });

  // ── State ─────────────────────────────────────────────────────────────────
  let qIndex        = 0;       // next question to show
  let inactiveTimer = null;    // 10s inactivity timer
  let barMode       = "none";  // "question" | "skip" | "none"
  let sessionActive = false;   // true while in a chat
  let waitingForAnswer = false;// true after we sent a question, waiting for stranger's reply

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const qbar           = document.getElementById("qbar");
  const qbarQuestion   = document.getElementById("qbarQuestion");
  const qbarChip       = document.getElementById("qbarChip");
  const qbarSkipPrompt = document.getElementById("qbarSkipPrompt");
  const qbarSkipBtn    = document.getElementById("qbarSkipBtn");
  const skipBtnEl      = document.getElementById("skipBtn");
  const msgInputEl     = document.getElementById("messageInput");

  if (!qbar) return; // element not found — bail silently

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showBar(mode) {
    barMode = mode;
    qbar.classList.remove("hidden");

    if (mode === "question") {
      qbarQuestion.classList.remove("hidden");
      qbarSkipPrompt.classList.add("hidden");
      // Animate chip re-render
      qbarChip.style.animation = "none";
      requestAnimationFrame(() => {
        qbarChip.style.animation = "";
        qbarChip.classList.remove("hidden");
      });
    } else if (mode === "skip") {
      qbarQuestion.classList.add("hidden");
      qbarSkipPrompt.classList.remove("hidden");
    }
  }

  function hideBar() {
    barMode = "none";
    qbar.classList.add("hidden");
    clearInactiveTimer();
  }

  function startInactiveTimer() {
    clearInactiveTimer();
    inactiveTimer = setTimeout(() => {
      if (!sessionActive || !connected) return;
      showBar("skip");
    }, 10_000);
  }

  function clearInactiveTimer() {
    clearTimeout(inactiveTimer);
    inactiveTimer = null;
  }

  // Advance to and display the next question
  function showNextQuestion() {
    if (qIndex >= QUESTIONS.length) {
      hideBar(); // all questions exhausted
      return;
    }
    const q = QUESTIONS[qIndex];
    qbarChip.textContent = q.text; // ::after pseudo adds "→"
    showBar("question");
    startInactiveTimer();
  }

  // Called whenever any message is sent (by us or after answer received)
  function onMessageActivity() {
    if (!sessionActive) return;
    clearInactiveTimer();
    // If skip prompt was showing, go back to question mode
    if (barMode === "skip") {
      showNextQuestion();
      return;
    }
    // If we were showing a question, hide bar; next question shows after reply
    if (barMode === "question") {
      hideBar();
    }
    // Restart inactivity timer for next cycle
    startInactiveTimer();
  }

  // ── Click: send question ──────────────────────────────────────────────────
  qbarChip.addEventListener("click", () => {
    if (!connected || qIndex >= QUESTIONS.length) return;
    const q = QUESTIONS[qIndex];
    // Use existing sendMessage text path via direct socket emit + appendMessage
    // (avoids side-effects of filling textarea)
    sendQuestionAsMessage(q.text);
    qIndex++;
    hideBar();
    waitingForAnswer = true;
    startInactiveTimer();
  });

  // ── Click: skip via skip prompt ───────────────────────────────────────────
  qbarSkipBtn.addEventListener("click", () => {
    hideBar();
    // Trigger existing skip logic
    skipBtnEl?.click();
  });

  // ── Send question using existing system ───────────────────────────────────
  function sendQuestionAsMessage(text) {
    if (!connected) return;
    socket.emit("message", text);
    appendMessage("you", text, "text");
  }

  // ── Send answer using existing system ─────────────────────────────────────
  function sendAnswerAsMessage(text) {
    if (!connected) return;
    socket.emit("message", text);
    appendMessage("you", text, "text");
  }

  // ── Intercept incoming messages to check for question matches ────────────
  // We monkey-patch the "message" socket listener ADDITION (non-destructive).
  // Original listener at line ~567 still fires first.
  socket.on("message", (text) => {
    if (!sessionActive) return;
    const trimmed = text.trim();

    // Check if this incoming message is a question we have choices for
    if (CHOICE_MAP[trimmed]) {
      // Append interactive choice buttons to the last "them" bubble
      setTimeout(() => attachChoicesToLastBubble(trimmed, CHOICE_MAP[trimmed]), 30);
    }

    // Any incoming message cancels the skip prompt / advances question state
    if (barMode === "skip") {
      showNextQuestion();
    } else if (waitingForAnswer) {
      waitingForAnswer = false;
      // Small delay before showing next question so it feels natural
      setTimeout(showNextQuestion, 800);
    }

    clearInactiveTimer();
    startInactiveTimer();
  });

  // When we send any message (typing + enter or send button), notify bar
  // We do this by observing messageInput keydown + sendBtn click
  function notifySent() {
    if (!sessionActive) return;
    onMessageActivity();
  }

  // Observe existing sendMessage triggers non-destructively
  document.getElementById("sendBtn")?.addEventListener("click", notifySent, true);
  document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) notifySent();
  }, true);

  // ── Attach choice buttons to the last received bubble ────────────────────
  function attachChoicesToLastBubble(questionText, choices) {
    const allBubbles = document.querySelectorAll(".msg.them .msg-inner");
    if (!allBubbles.length) return;
    const lastInner = allBubbles[allBubbles.length - 1];

    // Don't double-attach
    if (lastInner.querySelector(".msg-choices")) return;

    const choicesEl = document.createElement("div");
    choicesEl.className = "msg-choices";
    choicesEl.setAttribute("data-question", questionText);

    choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className   = "msg-choice-btn";
      btn.textContent = choice;
      btn.addEventListener("click", () => {
        if (choicesEl.classList.contains("answered")) return;
        // Mark chosen
        choicesEl.classList.add("answered");
        btn.classList.add("chosen");
        // Send as message
        sendAnswerAsMessage(choice);
        // Advance question bar
        if (barMode === "skip") showNextQuestion();
        else if (qIndex < QUESTIONS.length) {
          setTimeout(showNextQuestion, 600);
        }
      });
      choicesEl.appendChild(btn);
    });

    lastInner.appendChild(choicesEl);
    // Scroll down to show choices
    const msgsEl = document.getElementById("messages");
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  // ── Reset on new match ────────────────────────────────────────────────────
  socket.on("matched", () => {
    qIndex           = 0;
    waitingForAnswer = false;
    sessionActive    = true;
    barMode          = "none";
    clearInactiveTimer();
    // Show first question after a short welcome delay
    setTimeout(showNextQuestion, 1200);
  });

  // ── Reset on leaving chat ─────────────────────────────────────────────────
  function resetBar() {
    sessionActive    = false;
    waitingForAnswer = false;
    qIndex           = 0;
    barMode          = "none";
    hideBar();
  }

  socket.on("partnerLeft",  resetBar);
  socket.on("waiting",      resetBar);
  socket.on("disconnect",   resetBar);

  // Also hook into back button and skip button resets
  document.getElementById("btnBack")?.addEventListener("click", resetBar, true);
  document.getElementById("skipBtn")?.addEventListener("click", resetBar, true);

})(); // end QuestionBar IIFE
