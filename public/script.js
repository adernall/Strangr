/* ── Strangr v2 — client script ─────────────────────────────────────────────── */
"use strict";

// ── Screen elements ───────────────────────────────────────────────────────────
const homeScreen  = document.getElementById("homeScreen");
const chatScreen  = document.getElementById("chatScreen");
const btnStart    = document.getElementById("btnStart");
const btnBack     = document.getElementById("btnBack");

// ── Chat DOM refs ─────────────────────────────────────────────────────────────
const messagesEl   = document.getElementById("messages");
const emptyStateEl = document.getElementById("emptyState");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const roomTag      = document.getElementById("roomTag");
const messageInput = document.getElementById("messageInput");
const sendBtn      = document.getElementById("sendBtn");
const skipBtn      = document.getElementById("skipBtn");
const charCountEl  = document.getElementById("charCount");
const onlineCount  = document.getElementById("onlineCount");
const onlineCountHome = document.getElementById("onlineCountHome");

// ── Instagram DOM refs ────────────────────────────────────────────────────────
const igModal      = document.getElementById("igModal");
const igInput      = document.getElementById("igInput");
const igModalClose = document.getElementById("igModalClose");
const igModalCancel= document.getElementById("igModalCancel");
const igModalSave  = document.getElementById("igModalSave");
const btnIgAdd     = document.getElementById("btnIgAdd");
const btnIgShare   = document.getElementById("btnIgShare");

// ── State ─────────────────────────────────────────────────────────────────────
let connected   = false;
let roomSize    = 2;      // current chosen room size
let myIgHandle  = null;   // saved Instagram username

// ── Socket ────────────────────────────────────────────────────────────────────
const socket = io({ transports: ["websocket", "polling"], autoConnect: false });

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
function showHome() {
  homeScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
}

function showChat(size) {
  roomSize = size;
  homeScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");

  // Connect socket if not yet connected
  if (!socket.connected) socket.connect();

  socket.emit("joinQueue", { size });
}

// Start 1-on-1
btnStart.addEventListener("click", () => showChat(2));

// Group buttons
document.querySelectorAll(".btn-group").forEach((btn) => {
  btn.addEventListener("click", () => showChat(Number(btn.dataset.size)));
});

// Back button — leave room and go home
btnBack.addEventListener("click", () => {
  if (userIsInRoom()) socket.emit("skip", { size: roomSize });
  socket.disconnect();
  connected = false;
  clearMessages();
  showHome();
});

function userIsInRoom() {
  return connected;
}

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
  if (enabled) messageInput.focus();
}

function setRoomTag(size) {
  if (size === 2) {
    roomTag.classList.add("hidden");
  } else {
    roomTag.textContent = `${size}-person group`;
    roomTag.classList.remove("hidden");
  }
}

function appendMessage(type, text, isIgCard = false) {
  if (emptyStateEl) emptyStateEl.style.display = "none";

  const msgEl = document.createElement("div");
  msgEl.className = `msg ${type}`;

  if (type === "system") {
    msgEl.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  } else if (isIgCard) {
    // text is IG username here
    const handle = escapeHtml(text);
    const profileUrl = `https://instagram.com/${handle}`;
    msgEl.innerHTML = `
      <div class="msg-inner">
        <span class="msg-label">${type === "you" ? "You shared" : "Stranger shared"}</span>
        <a class="ig-card" href="${profileUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open @${handle} on Instagram">
          <div class="ig-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <circle cx="12" cy="12" r="4"></circle>
              <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none"></circle>
            </svg>
          </div>
          <div class="ig-card-text">
            <span class="ig-card-name">@${handle}</span>
            <span class="ig-card-handle">Instagram · tap to open</span>
          </div>
        </a>
      </div>`;
  } else {
    const label = type === "you" ? "You" : "Stranger";
    msgEl.innerHTML = `
      <div class="msg-inner">
        <span class="msg-label">${label}</span>
        <div class="bubble">${escapeHtml(text)}</div>
      </div>`;
  }

  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages() {
  [...messagesEl.children].forEach((el) => {
    if (el.id !== "emptyState") el.remove();
  });
  if (emptyStateEl) emptyStateEl.style.display = "";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
}

// ── Online count ──────────────────────────────────────────────────────────────
async function fetchStats() {
  try {
    const res = await fetch("/stats");
    if (!res.ok) return;
    const data = await res.json();
    const n = data.online ?? "—";
    if (onlineCount)     onlineCount.textContent     = n;
    if (onlineCountHome) onlineCountHome.textContent = n;
  } catch { /* ignore */ }
}
fetchStats();
setInterval(fetchStats, 10_000);

// ══════════════════════════════════════════════════════════════════════════════
// SOCKET EVENTS
// ══════════════════════════════════════════════════════════════════════════════
socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
});

socket.on("waiting", ({ size }) => {
  const label = size > 2 ? `Waiting for ${size}-person group…` : "Finding a stranger…";
  setStatus("waiting", label);
  setInputEnabled(false);
  clearMessages();
  setRoomTag(0);
});

socket.on("matched", ({ size }) => {
  const label = size > 2 ? `Connected to a group of ${size}!` : "Connected — say hi!";
  setStatus("connected", label);
  setInputEnabled(true);
  setRoomTag(size);
  const sysmsg = size > 2
    ? `You're now in a ${size}-person anonymous group chat.`
    : "You're now chatting with a stranger.";
  appendMessage("system", sysmsg);
});

socket.on("message", (text) => {
  appendMessage("them", text);
});

socket.on("igShare", (username) => {
  appendMessage("them", username, true);
});

socket.on("partnerLeft", () => {
  setStatus("left", "Stranger disconnected");
  setInputEnabled(false);
  appendMessage("system", "Stranger has left the chat.");
});

socket.on("disconnect", () => {
  if (chatScreen.classList.contains("hidden")) return; // user went home
  setStatus("waiting", "Connection lost — reconnecting…");
  setInputEnabled(false);
});

// ══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ══════════════════════════════════════════════════════════════════════════════
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !connected) return;
  socket.emit("message", text);
  appendMessage("you", text);
  messageInput.value = "";
  charCountEl.textContent = "0 / 500";
  charCountEl.classList.remove("warn");
  resizeInput();
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

messageInput.addEventListener("input", () => {
  resizeInput();
  const len = messageInput.value.length;
  charCountEl.textContent = `${len} / 500`;
  charCountEl.classList.toggle("warn", len > 450);
});

// ── Skip ──────────────────────────────────────────────────────────────────────
skipBtn.addEventListener("click", () => {
  socket.emit("skip", { size: roomSize });
  setStatus("waiting", "Finding a new stranger…");
  setInputEnabled(false);
  clearMessages();
  setRoomTag(0);
});

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM FEATURE
// ══════════════════════════════════════════════════════════════════════════════
function openIgModal() {
  igInput.value = myIgHandle || "";
  igModal.classList.remove("hidden");
  setTimeout(() => igInput.focus(), 50);
}

function closeIgModal() {
  igModal.classList.add("hidden");
}

function saveIgHandle() {
  const raw = igInput.value.trim().replace(/^@/, "");
  if (!raw) { igInput.focus(); return; }
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(raw)) {
    igInput.style.borderColor = "var(--danger)";
    igInput.placeholder = "Only letters, numbers, _ and .";
    setTimeout(() => { igInput.style.borderColor = ""; igInput.placeholder = "yourhandle"; }, 2000);
    return;
  }
  myIgHandle = raw;
  // Swap buttons
  btnIgAdd.classList.add("hidden");
  btnIgShare.classList.remove("hidden");
  closeIgModal();
}

function sendIgShare() {
  if (!myIgHandle || !connected) return;
  socket.emit("igShare", myIgHandle);
  appendMessage("you", myIgHandle, true);
}

btnIgAdd.addEventListener("click", openIgModal);
btnIgShare.addEventListener("click", sendIgShare);
igModalClose.addEventListener("click", closeIgModal);
igModalCancel.addEventListener("click", closeIgModal);
igModalSave.addEventListener("click", saveIgHandle);

igInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveIgHandle(); }
  if (e.key === "Escape") closeIgModal();
});

// Close modal on overlay click
igModal.addEventListener("click", (e) => {
  if (e.target === igModal) closeIgModal();
});

// ── Init: start at home ───────────────────────────────────────────────────────
showHome();
