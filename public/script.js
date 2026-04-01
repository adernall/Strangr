/* ── Strangr — client script ───────────────────────────────────────────────── */
"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const messagesEl   = document.getElementById("messages");
const emptyStateEl = document.getElementById("emptyState");
const statusDot    = document.getElementById("statusDot");
const statusText   = document.getElementById("statusText");
const messageInput = document.getElementById("messageInput");
const sendBtn      = document.getElementById("sendBtn");
const skipBtn      = document.getElementById("skipBtn");
const charCountEl  = document.getElementById("charCount");
const onlineCount  = document.getElementById("onlineCount");

// ── State ─────────────────────────────────────────────────────────────────────
let connected = false;

// ── Socket ────────────────────────────────────────────────────────────────────
const socket = io({ transports: ["websocket", "polling"] });

// ── UI helpers ────────────────────────────────────────────────────────────────
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

function appendMessage(type, text) {
  // Hide empty state on first message
  if (emptyStateEl) emptyStateEl.style.display = "none";

  const msgEl = document.createElement("div");
  msgEl.className = `msg ${type}`;

  if (type === "system") {
    msgEl.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
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
  // Remove all children except emptyState
  [...messagesEl.children].forEach((el) => {
    if (el.id !== "emptyState") el.remove();
  });
  if (emptyStateEl) emptyStateEl.style.display = "";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Auto-resize textarea
function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px";
}

// ── Online count polling ──────────────────────────────────────────────────────
async function fetchStats() {
  try {
    const res = await fetch("/stats");
    if (!res.ok) return;
    const data = await res.json();
    onlineCount.textContent = data.online ?? "—";
  } catch {/* ignore */}
}
fetchStats();
setInterval(fetchStats, 10_000);

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
});

socket.on("waiting", () => {
  setStatus("waiting", "Finding a stranger…");
  setInputEnabled(false);
  clearMessages();
});

socket.on("matched", () => {
  setStatus("connected", "Connected — say hi!");
  setInputEnabled(true);
  appendMessage("system", "You're now chatting with a stranger.");
});

socket.on("message", (text) => {
  appendMessage("them", text);
});

socket.on("partnerLeft", () => {
  setStatus("left", "Stranger disconnected");
  setInputEnabled(false);
  appendMessage("system", "Stranger has left the chat.");
});

socket.on("disconnect", () => {
  setStatus("waiting", "Connection lost — reconnecting…");
  setInputEnabled(false);
});

// ── Send message ──────────────────────────────────────────────────────────────
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
  socket.emit("skip");
  setStatus("waiting", "Finding a new stranger…");
  setInputEnabled(false);
  clearMessages();
});
