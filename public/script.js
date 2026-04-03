/* ── Strangr v3 — client script ─────────────────────────────────────────────── */
"use strict";

// ── Screen elements ───────────────────────────────────────────────────────────
const homeScreen  = document.getElementById("homeScreen");
const chatScreen  = document.getElementById("chatScreen");
const btnStart    = document.getElementById("btnStart");
const btnBack     = document.getElementById("btnBack");

// ── Chat DOM refs ─────────────────────────────────────────────────────────────
const messagesEl      = document.getElementById("messages");
const emptyStateEl    = document.getElementById("emptyState");
const statusDot       = document.getElementById("statusDot");
const statusText      = document.getElementById("statusText");
const roomTag         = document.getElementById("roomTag");
const messageInput    = document.getElementById("messageInput");
const sendBtn         = document.getElementById("sendBtn");
const skipBtn         = document.getElementById("skipBtn");
const charCountEl     = document.getElementById("charCount");
const onlineCount     = document.getElementById("onlineCount");
const onlineCountHome = document.getElementById("onlineCountHome");
const typingIndicator = document.getElementById("typingIndicator");

// ── Instagram DOM refs ────────────────────────────────────────────────────────
const igModal       = document.getElementById("igModal");
const igInput       = document.getElementById("igInput");
const igModalClose  = document.getElementById("igModalClose");
const igModalCancel = document.getElementById("igModalCancel");
const igModalSave   = document.getElementById("igModalSave");
const btnIgAdd      = document.getElementById("btnIgAdd");
const btnIgShare    = document.getElementById("btnIgShare");

// ── Image DOM refs ────────────────────────────────────────────────────────────
const btnImg    = document.getElementById("btnImg");
const imageInput = document.getElementById("imageInput");

// ── Legal DOM refs ────────────────────────────────────────────────────────────
const legalModal      = document.getElementById("legalModal");
const legalModalClose = document.getElementById("legalModalClose");
const legalBody       = document.getElementById("legalBody");

// ── Toast ─────────────────────────────────────────────────────────────────────
const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(msg, type = "", duration = 3500) {
  toastEl.textContent = msg;
  toastEl.className = `toast show${type ? " toast-" + type : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = "toast"; }, duration);
}

// ── State ─────────────────────────────────────────────────────────────────────
let connected  = false;
let roomSize   = 2;
let myIgHandle = null;
let pendingImg = null;   // { dataUrl, blob } — image selected but not yet sent

// ── Socket ────────────────────────────────────────────────────────────────────
const socket = io({ transports: ["websocket", "polling"], autoConnect: false });

// ══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

// Request permission once, on first user interaction
let notifPermission = Notification?.permission ?? "denied";

async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (notifPermission === "granted") return;
  if (notifPermission === "denied") return;
  notifPermission = await Notification.requestPermission();
}

// Chime sound — generated via Web Audio API, no file needed
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Two-note chime: C5 then E5
    [[523.25, now], [659.25, now + 0.18]].forEach(([freq, start]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  } catch { /* AudioContext blocked = no sound, that's fine */ }
}

function notifyUser(title, body) {
  // Only fire notification when the tab is hidden
  if (document.visibilityState === "visible") return;

  playChime();

  if (notifPermission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>",
        tag:  "strangr-match",   // replaces previous notification of same tag
        renotify: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* ignore */ }
  }
}

// Request permission when user clicks Start (needs user gesture)
function initNotifications() {
  requestNotifPermission();
}

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
  initNotifications();
  if (!socket.connected) socket.connect();
  socket.emit("joinQueue", { size });
}

btnStart.addEventListener("click", () => showChat(2));

document.querySelectorAll(".btn-group").forEach((btn) => {
  btn.addEventListener("click", () => showChat(Number(btn.dataset.size)));
});

btnBack.addEventListener("click", () => {
  if (connected) socket.emit("skip", { size: roomSize });
  stopTyping();
  socket.disconnect();
  connected = false;
  showTypingIndicator(false);
  clearMessages();
  clearPendingImg();
  showHome();
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

function setRoomTag(size) {
  if (size <= 2) { roomTag.classList.add("hidden"); return; }
  roomTag.textContent = `${size}-person group`;
  roomTag.classList.remove("hidden");
}

// ── Append message ────────────────────────────────────────────────────────────
function appendMessage(type, content, mode = "text") {
  if (emptyStateEl) emptyStateEl.style.display = "none";

  const msgEl = document.createElement("div");
  msgEl.className = `msg ${type}`;

  if (type === "system") {
    msgEl.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>`;

  } else if (mode === "image") {
    const label = type === "you" ? "You" : "Stranger";
    msgEl.innerHTML = `
      <div class="msg-inner">
        <span class="msg-label">${label}</span>
        <div class="img-bubble" role="button" tabindex="0" aria-label="View image">
          <img src="${content}" alt="Shared image" loading="lazy" />
        </div>
      </div>`;
    // Lightbox on click
    const imgBubble = msgEl.querySelector(".img-bubble");
    imgBubble.addEventListener("click",  () => openLightbox(content));
    imgBubble.addEventListener("keydown", e => e.key === "Enter" && openLightbox(content));

  } else if (mode === "igCard") {
    const handle = escapeHtml(content);
    msgEl.innerHTML = `
      <div class="msg-inner">
        <span class="msg-label">${type === "you" ? "You shared" : "Stranger shared"}</span>
        <a class="ig-card" href="https://instagram.com/${handle}" target="_blank" rel="noopener noreferrer">
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
        <div class="bubble">${escapeHtml(content)}</div>
      </div>`;
  }

  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages() {
  [...messagesEl.children].forEach((el) => { if (el.id !== "emptyState") el.remove(); });
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

// ── Lightbox ──────────────────────────────────────────────────────────────────
function openLightbox(src) {
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `<img src="${src}" alt="Full size image" />`;
  lb.addEventListener("click", () => lb.remove());
  document.body.appendChild(lb);
}

// ── Online count ──────────────────────────────────────────────────────────────
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
socket.on("connect", () => console.log("[socket] connected:", socket.id));

socket.on("waiting", ({ size }) => {
  setStatus("waiting", size > 2 ? `Waiting for ${size}-person group…` : "Finding a stranger…");
  setInputEnabled(false);
  showTypingIndicator(false);
  clearMessages();
  setRoomTag(0);
});

socket.on("matched", ({ size }) => {
  setStatus("connected", size > 2 ? `Connected to a group of ${size}!` : "Connected — say hi!");
  setInputEnabled(true);
  setRoomTag(size);
  appendMessage("system", size > 2
    ? `You're now in a ${size}-person anonymous group chat.`
    : "You're now chatting with a stranger.");

  // ── Push notification (fires only if tab is hidden) ──
  notifyUser("Strangr ⚡", size > 2
    ? `Joined a ${size}-person group!`
    : "A stranger connected — say hi!");
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

// ── Typing indicator — receive ────────────────────────────────────────────────
function showTypingIndicator(show) {
  typingIndicator.classList.toggle("hidden", !show);
  if (show) messagesEl.scrollTop = messagesEl.scrollHeight;
}

socket.on("typing", (isTyping) => {
  showTypingIndicator(isTyping);
});

socket.on("partnerLeft", () => {
  showTypingIndicator(false);
  setStatus("left", "Stranger disconnected");
  setInputEnabled(false);
  appendMessage("system", "Stranger has left the chat.");
});

socket.on("disconnect", () => {
  if (chatScreen.classList.contains("hidden")) return;
  setStatus("waiting", "Connection lost — reconnecting…");
  setInputEnabled(false);
});

// Rate limited feedback
socket.on("rateLimited", ({ action, retryAfter }) => {
  const msgs = {
    message:   `Slow down! Wait ${retryAfter}s before sending more messages.`,
    skip:      `Too many skips! Wait ${retryAfter}s.`,
    igShare:   `IG share limit hit. Wait ${retryAfter}s.`,
    imageShare:`Image limit hit. Wait ${retryAfter}s.`,
    joinQueue: `Queue join limit hit. Wait ${retryAfter}s.`,
  };
  showToast(msgs[action] || `Rate limited. Retry in ${retryAfter}s.`, "warn");
});

// ══════════════════════════════════════════════════════════════════════════════
// SEND TEXT MESSAGE
// ══════════════════════════════════════════════════════════════════════════════
function sendMessage() {
  // If there's a pending image, send that first (regardless of text)
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

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ── Typing indicator — emit ───────────────────────────────────────────────────
let typingTimeout = null;
let isTypingEmitted = false;

messageInput.addEventListener("input", () => {
  resizeInput();
  const len = messageInput.value.length;
  charCountEl.textContent = `${len} / 500`;
  charCountEl.classList.toggle("warn", len > 450);

  if (!connected) return;

  // Emit "started typing" only once per burst
  if (!isTypingEmitted) {
    socket.emit("typing", true);
    isTypingEmitted = true;
  }

  // Reset the stop-typing timer on every keystroke
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("typing", false);
    isTypingEmitted = false;
  }, 1500); // stop indicator 1.5s after last keystroke
});

skipBtn.addEventListener("click", () => {
  socket.emit("skip", { size: roomSize });
  setStatus("waiting", "Finding a new stranger…");
  setInputEnabled(false);
  showTypingIndicator(false);
  stopTyping();
  clearMessages();
  clearPendingImg();
  setRoomTag(0);
});

// ══════════════════════════════════════════════════════════════════════════════
// IMAGE SHARING
// ══════════════════════════════════════════════════════════════════════════════
const MAX_IMG_BYTES = 2 * 1024 * 1024; // 2 MB cap

btnImg.addEventListener("click", () => {
  if (!connected) return;
  imageInput.value = ""; // reset so same file can be re-selected
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Only image files are supported.", "error"); return;
  }
  if (file.size > MAX_IMG_BYTES) {
    showToast("Image too large. Max size is 2 MB.", "error"); return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    pendingImg = e.target.result; // base64 data URL
    showImgPreview(pendingImg);
  };
  reader.readAsDataURL(file);
});

function showImgPreview(dataUrl) {
  // Remove old preview if any
  clearPendingImg(false);

  const wrap = document.createElement("div");
  wrap.className = "img-preview-wrap";
  wrap.id = "imgPreviewWrap";
  wrap.innerHTML = `
    <img src="${dataUrl}" alt="preview" />
    <button class="img-preview-clear" id="imgPreviewClear" aria-label="Cancel image">✕</button>`;

  // Insert above the input row
  const inputArea = document.querySelector(".input-area");
  inputArea.insertBefore(wrap, inputArea.firstChild);

  document.getElementById("imgPreviewClear").addEventListener("click", () => clearPendingImg(true));
  // Preview is shown — user taps Send (button or Enter) to actually send it
}

function sendPendingImage() {
  if (!pendingImg || !connected) return;
  socket.emit("imageShare", pendingImg);
  appendMessage("you", pendingImg, "image");
  clearPendingImg(true);
}

function clearPendingImg(removePreview = true) {
  pendingImg = null;
  if (removePreview) {
    document.getElementById("imgPreviewWrap")?.remove();
  }
}

// ── Paste image support ───────────────────────────────────────────────────────
// Works when pasting anywhere on the page (Ctrl+V / Cmd+V)
document.addEventListener("paste", (e) => {
  if (!connected) return;

  const items = Array.from(e.clipboardData?.items || []);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) return; // no image in clipboard — let normal paste proceed

  e.preventDefault(); // stop it from pasting as text

  const file = imageItem.getAsFile();
  if (!file) return;

  if (file.size > MAX_IMG_BYTES) {
    showToast("Pasted image too large. Max size is 2 MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingImg = ev.target.result;
    showImgPreview(pendingImg);
    showToast("Image ready — press Enter or Send to share.", "success", 2500);
  };
  reader.readAsDataURL(file);
});

// ══════════════════════════════════════════════════════════════════════════════
// INSTAGRAM FEATURE
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
    showToast("Invalid username. Only letters, numbers, _ and . allowed.", "error");
    return;
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

btnIgAdd.addEventListener("click", openIgModal);
btnIgShare.addEventListener("click", sendIgShare);
igModalClose.addEventListener("click", closeIgModal);
igModalCancel.addEventListener("click", closeIgModal);
igModalSave.addEventListener("click", saveIgHandle);
igInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveIgHandle(); }
  if (e.key === "Escape") closeIgModal();
});
igModal.addEventListener("click", (e) => { if (e.target === igModal) closeIgModal(); });

// ══════════════════════════════════════════════════════════════════════════════
// LEGAL MODAL
// ══════════════════════════════════════════════════════════════════════════════
const LEGAL_CONTENT = {
  guidelines: {
    title: "Community Guidelines",
    html: `
<h2>Community Guidelines</h2>
<p>Strangr is built for safe, respectful, and meaningful interactions. Follow these rules to stay on the platform.</p>
<hr/>
<h3>1. Respect Others</h3>
<ul><li>No harassment, bullying, or hate speech</li><li>No threats or intimidation</li></ul>
<h3>2. No Explicit or Illegal Content</h3>
<ul><li>No sexual content</li><li>No nudity or exploitation</li><li>No illegal discussions or activities</li></ul>
<h3>3. No Spam or Scams</h3>
<ul><li>Do not send repetitive or unwanted messages</li><li>No promotions, ads, or phishing attempts</li></ul>
<h3>4. No Impersonation</h3>
<ul><li>Do not pretend to be someone else</li><li>Do not mislead users</li></ul>
<h3>5. Protect Privacy</h3>
<ul><li>Do not ask for or share personal information</li><li>Do not attempt to track or expose others</li></ul>
<h3>6. Follow Platform Rules</h3>
<ul><li>Respect rate limits and system restrictions</li><li>Do not attempt to bypass bans or restrictions</li></ul>
<h3>7. Consequences</h3>
<p>Violations may result in a warning, temporary ban, or permanent ban.</p>
<hr/>
<p>If you see someone violating rules, report them immediately. Strangr is anonymous — but your behavior still has consequences.</p>`
  },
  privacy: {
    title: "Privacy Policy",
    html: `
<h2>Privacy Policy</h2>
<p><strong>Effective Date:</strong> April 3, 2026</p>
<hr/>
<h3>1. Information We Collect</h3>
<p>We may collect IP address, device/browser information, and usage activity. We do <strong>not</strong> require real names or personal identity to use the platform.</p>
<h3>2. How We Use Information</h3>
<ul><li>Operate and improve the platform</li><li>Detect and prevent abuse, spam, and illegal activity</li><li>Enforce our Terms and Conditions</li></ul>
<h3>3. Data Storage</h3>
<p>Your data may be stored securely on our servers. We take reasonable steps to protect it but cannot guarantee absolute security.</p>
<h3>4. Sharing of Information</h3>
<p>We do <strong>not</strong> sell your data. We may share data only if required by law, to prevent fraud, or to protect users and platform integrity.</p>
<h3>5. Cookies &amp; Tracking</h3>
<p>We may use cookies or similar technologies to maintain sessions, improve performance, and analyze usage.</p>
<h3>6. User Safety</h3>
<p>While we take steps to moderate the platform, users interact at their own risk. Do not share personal, sensitive, or private information with strangers.</p>
<h3>7. Changes to Policy</h3>
<p>We may update this Privacy Policy at any time. Continued use means acceptance of changes.</p>
<hr/>
<p>By using Strangr, you agree to this Privacy Policy.</p>`
  },
  terms: {
    title: "Terms and Conditions",
    html: `
<h2>Terms and Conditions</h2>
<p><strong>Effective Date:</strong> April 3, 2026</p>
<hr/>
<h3>1. Use of Service</h3>
<p>Strangr provides an anonymous chat platform that connects users randomly. You agree to use the platform responsibly and lawfully. You must be at least <strong>13 years old</strong> to use this service.</p>
<h3>2. Prohibited Conduct</h3>
<p>You agree NOT to:</p>
<ul>
  <li>Harass, abuse, threaten, or harm other users</li>
  <li>Share illegal, explicit, or offensive content</li>
  <li>Impersonate another person or mislead others</li>
  <li>Spam, scam, or attempt to exploit the platform</li>
  <li>Attempt to hack, disrupt, or overload the system</li>
</ul>
<h3>3. User Responsibility</h3>
<p>You are solely responsible for your actions and any content you share while using Strangr. We do not monitor all interactions in real-time and are not responsible for user behavior.</p>
<h3>4. Moderation &amp; Enforcement</h3>
<p>We reserve the right to warn, suspend, or permanently ban users; remove content without notice; and restrict access based on violations. Decisions made by Strangr are final.</p>
<h3>5. Privacy</h3>
<p>We may collect basic data such as IP address, device information, and usage activity. Please refer to our Privacy Policy for more details.</p>
<h3>6. Limitation of Liability</h3>
<p>Strangr is provided "as is" without warranties of any kind. We are not liable for user behavior, any damages resulting from use of the platform, or loss of data.</p>
<h3>7. Termination</h3>
<p>We reserve the right to terminate or restrict access to the platform at any time without prior notice.</p>
<h3>8. Changes to Terms</h3>
<p>We may update these Terms at any time. Continued use of the platform means you accept the updated Terms.</p>
<hr/>
<p>By using Strangr, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.</p>`
  }
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
  // Update tab active state
  document.querySelectorAll(".legal-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
}

// Legal links on home page
document.querySelectorAll(".legal-link").forEach((btn) => {
  btn.addEventListener("click", () => openLegalModal(btn.dataset.tab));
});

// Tabs inside modal
document.querySelectorAll(".legal-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    activeLegalTab = tab.dataset.tab;
    renderLegalContent(activeLegalTab);
  });
});

legalModalClose.addEventListener("click", closeLegalModal);
legalModal.addEventListener("click", (e) => { if (e.target === legalModal) closeLegalModal(); });

// ── Init ──────────────────────────────────────────────────────────────────────
showHome();
