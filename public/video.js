/**
 * video.js  —  Strangr Video Call Module
 * ─────────────────────────────────────────
 * Self-contained IIFE. Reads from globals set by script.js:
 *   window.socket, window.connected, window.appendMessage,
 *   window.showToast, window.myLabel, window.strangerLabel
 *
 * Server-side signaling events already exist in server.js:
 *   vcRequest, vcAccept, vcDecline, vcEnd, vcEmoji,
 *   vcOffer, vcAnswer, vcIce
 */
(function VideoCall() {
  "use strict";

  /* ── Wait for full page load so all DOM elements exist ── */
  if (document.readyState !== "complete") {
    window.addEventListener("load", boot);
  } else {
    setTimeout(boot, 0);
  }

  /* ════════════════════════════════════════════════════════
     STATE
  ════════════════════════════════════════════════════════ */
  let pc           = null;    // RTCPeerConnection
  let localStream  = null;
  let isCaller     = false;
  let callActive   = false;
  let micOn        = true;
  let camOn        = true;
  let emojiTimer   = null;

  const STUN = { iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]};

  const RECENT_KEY = "strangr_vc_recents";
  const MAX_REC    = 16;
  const EMOJI_TTL  = 4000;

  /* ════════════════════════════════════════════════════════
     DOM REFS  (resolved in boot)
  ════════════════════════════════════════════════════════ */
  let S; // socket alias
  let vcScreen, btnVC,
      /* desktop */
      dLocalVideo, dRemoteVideo, dLocalTile, dRemoteTile,
      dMicBtn, dCamBtn, dEndBtn,
      dEmojiTrigger, dEmojiPanel,
      dMsgArea, dChatFooter, dEmojiFloat,
      /* mobile */
      mLocalVideo, mRemoteVideo, mLocalTile, mRemoteTile,
      mMicBtn, mCamBtn, mEmojiTrigger, mEndBtn,
      mEmojiFloat, mEmojiPanel;

  /* ════════════════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════════════════ */
  function boot() {
    S = window.socket;
    if (!S) { console.warn("[VC] socket not ready"); return; }

    vcScreen      = document.getElementById("vcScreen");
    btnVC         = document.getElementById("btnVideoCall");

    /* desktop */
    dLocalVideo   = document.getElementById("vcLocalD");
    dRemoteVideo  = document.getElementById("vcRemoteD");
    dLocalTile    = document.getElementById("vcLocalTileD");
    dRemoteTile   = document.getElementById("vcRemoteTileD");
    dMicBtn       = document.getElementById("vcMicD");
    dCamBtn       = document.getElementById("vcCamD");
    dEndBtn       = document.getElementById("vcEndD");
    dEmojiTrigger = document.getElementById("vcEmojiTriggerD");
    dEmojiPanel   = document.getElementById("vcEmojiPanelD");
    dMsgArea      = document.getElementById("vcMsgArea");
    dChatFooter   = document.getElementById("vcChatFooter");
    dEmojiFloat   = document.getElementById("vcEmojiFloatD");

    /* mobile */
    mLocalVideo   = document.getElementById("vcLocalM");
    mRemoteVideo  = document.getElementById("vcRemoteM");
    mLocalTile    = document.getElementById("vcLocalTileM");
    mRemoteTile   = document.getElementById("vcRemoteTileM");
    mMicBtn       = document.getElementById("vcMicM");
    mCamBtn       = document.getElementById("vcCamM");
    mEmojiTrigger = document.getElementById("vcEmojiTriggerM");
    mEndBtn       = document.getElementById("vcEndM");
    mEmojiFloat   = document.getElementById("vcEmojiFloatM");
    mEmojiPanel   = document.getElementById("vcEmojiPanelM");

    if (!vcScreen) { console.warn("[VC] #vcScreen missing"); return; }

    buildEmojiPanels();
    bindUI();
    bindSocket();
  }

  /* ════════════════════════════════════════════════════════
     UI EVENT BINDINGS
  ════════════════════════════════════════════════════════ */
  function bindUI() {
    btnVC?.addEventListener("click", requestCall);

    /* desktop controls */
    dMicBtn?.addEventListener("click", toggleMic);
    dCamBtn?.addEventListener("click", toggleCam);
    dEndBtn?.addEventListener("click", endLocal);

    /* mobile controls */
    mMicBtn?.addEventListener("click", toggleMic);
    mCamBtn?.addEventListener("click", toggleCam);
    mEndBtn?.addEventListener("click", endLocal);

    /* emoji panel desktop */
    dEmojiTrigger?.addEventListener("click", e => {
      e.stopPropagation();
      dEmojiPanel?.classList.toggle("ep-open");
    });
    document.addEventListener("click", e => {
      if (dEmojiPanel && !dEmojiPanel.contains(e.target) && e.target !== dEmojiTrigger) {
        dEmojiPanel?.classList.remove("ep-open");
      }
    });

    /* emoji panel mobile */
    mEmojiTrigger?.addEventListener("click", e => {
      e.stopPropagation();
      mEmojiPanel?.classList.toggle("ep-open");
    });
    mEmojiPanel?.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", e => {
      if (mEmojiPanel?.classList.contains("ep-open") &&
          !mEmojiPanel.contains(e.target) && e.target !== mEmojiTrigger) {
        mEmojiPanel.classList.remove("ep-open");
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     SOCKET BINDINGS
  ════════════════════════════════════════════════════════ */
  function bindSocket() {
    /* Incoming call request */
    S.on("vcRequest", () => {
      if (callActive) return;
      showRequestWidget("incoming");
    });

    /* Caller: partner accepted → start WebRTC offer */
    S.on("vcAccept", async () => {
      resolveWidget("accepted");
      await startMedia();
      showCallScreen();
      await createOffer();
    });

    /* Caller: partner declined */
    S.on("vcDecline", () => resolveWidget("declined"));

    /* WebRTC signaling */
    S.on("vcOffer",  async ({ sdp })       => handleOffer(sdp));
    S.on("vcAnswer", async ({ sdp })       => handleAnswer(sdp));
    S.on("vcIce",    ({ candidate })       => handleIce(candidate));

    /* Call ended remotely */
    S.on("vcEnd", () => {
      toast("Call ended by stranger.", "warn");
      cleanup();
    });

    /* Emoji from partner */
    S.on("vcEmoji", ({ emoji }) => showEmojiOverlay(emoji, false));

    /* Partner left mid-call */
    S.on("partnerLeft", () => { if (callActive) cleanup(); });

    /* New match → reset */
    S.on("matched", () => { if (callActive) cleanup(); });
  }

  /* ════════════════════════════════════════════════════════
     CALL REQUEST FLOW
  ════════════════════════════════════════════════════════ */
  function requestCall() {
    if (!window.connected || callActive) return;
    isCaller = true;
    S.emit("vcRequest");
    showRequestWidget("outgoing");
  }

  function showRequestWidget(dir) {
    const msgs = document.getElementById("messages");
    if (!msgs) return;

    /* Remove any existing widget */
    document.getElementById("vcReqWidget")?.remove();

    const wrap = document.createElement("div");
    wrap.className = "msg system";
    wrap.id        = "vcReqWidget";

    const w = document.createElement("div");
    w.className = "vc-req-widget";
    w.innerHTML = `
      <div class="vc-req-label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
        </svg>
        Video call ${dir === "outgoing" ? "request sent" : "incoming"}
      </div>
      ${dir === "incoming" ? `
        <div class="vc-req-btns">
          <button class="vc-accept"  id="vcAcceptBtn">Accept</button>
          <button class="vc-decline" id="vcDeclineBtn">Decline</button>
        </div>` : `
        <div class="vc-req-btns">
          <span style="font-size:12px;color:var(--text3)">Waiting…</span>
        </div>`}
      <div class="vc-req-status" id="vcReqStatus"></div>
    `;

    wrap.appendChild(w);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;

    if (dir === "incoming") {
      document.getElementById("vcAcceptBtn")?.addEventListener("click", acceptCall);
      document.getElementById("vcDeclineBtn")?.addEventListener("click", declineCall);
    }
  }

  function resolveWidget(state) {
    const w = document.querySelector("#vcReqWidget .vc-req-widget");
    if (!w) return;
    w.classList.add("resolved");
    const s = document.getElementById("vcReqStatus");
    if (s) s.textContent = state === "accepted" ? "✓ Call accepted" : "✕ Call declined";
  }

  async function acceptCall() {
    resolveWidget("accepted");
    S.emit("vcAccept");
    await startMedia();
    showCallScreen();
    /* callee waits for vcOffer — no createOffer here */
  }

  function declineCall() {
    resolveWidget("declined");
    S.emit("vcDecline");
  }

  /* ════════════════════════════════════════════════════════
     MEDIA + WEBRTC
  ════════════════════════════════════════════════════════ */
  async function startMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        toast("Camera unavailable — audio only", "warn");
      } catch {
        toast("Cannot access camera or microphone.", "error");
        return;
      }
    }
    /* attach to both layouts */
    [dLocalVideo, mLocalVideo].forEach(v => {
      if (v) { v.srcObject = localStream; v.muted = true; }
    });
  }

  function makePeer() {
    pc = new RTCPeerConnection(STUN);

    localStream?.getTracks().forEach(t => pc.addTrack(t, localStream));

    const remote = new MediaStream();
    pc.ontrack = ({ track }) => {
      remote.addTrack(track);
      [dRemoteVideo, mRemoteVideo].forEach(v => { if (v) v.srcObject = remote; });
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) S.emit("vcIce", { candidate });
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === "failed") {
        toast("Connection failed.", "error");
        endLocal();
      }
    };
  }

  async function createOffer() {
    makePeer();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    S.emit("vcOffer", { sdp: offer.sdp });
  }

  async function handleOffer(sdp) {
    if (!pc) makePeer();
    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    S.emit("vcAnswer", { sdp: answer.sdp });
  }

  async function handleAnswer(sdp) {
    if (pc) await pc.setRemoteDescription({ type: "answer", sdp });
  }

  function handleIce(candidate) {
    if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  }

  /* ════════════════════════════════════════════════════════
     SHOW / HIDE CALL SCREEN
  ════════════════════════════════════════════════════════ */
  function showCallScreen() {
    callActive = true;
    micOn = true; camOn = true;
    updateCtrlIcons();

    /* Move existing chat elements into the vc-chat col on desktop */
    const msgEl   = document.getElementById("messages");
    const tiEl    = document.getElementById("typingIndicator");
    const qbarEl  = document.getElementById("qbar");
    const inputEl = document.querySelector(".chat-input-area");

    if (dMsgArea && msgEl)   dMsgArea.appendChild(msgEl);
    if (dMsgArea && tiEl)    dMsgArea.appendChild(tiEl);
    if (dChatFooter && qbarEl)  dChatFooter.appendChild(qbarEl);
    if (dChatFooter && inputEl) dChatFooter.appendChild(inputEl);

    /* Fade in */
    vcScreen.style.display = "flex";
    requestAnimationFrame(() =>
      requestAnimationFrame(() => vcScreen.classList.add("vc-show"))
    );
  }

  function hideCallScreen() {
    vcScreen.classList.remove("vc-show");

    /* Move chat elements back to chat-app */
    const chatApp = document.getElementById("chatApp");
    const chatMain = chatApp?.querySelector(".chat-main");

    const msgEl   = document.getElementById("messages");
    const tiEl    = document.getElementById("typingIndicator");
    const qbarEl  = document.getElementById("qbar");
    const inputEl = document.querySelector(".chat-input-area");

    if (chatMain && msgEl)  chatMain.appendChild(msgEl);
    if (chatMain && tiEl)   chatMain.appendChild(tiEl);
    if (chatApp  && qbarEl) chatApp.insertBefore(qbarEl, inputEl);
    /* inputEl already in chatApp if not moved, or re-append */
    if (chatApp  && inputEl) chatApp.appendChild(inputEl);

    setTimeout(() => { vcScreen.style.display = "none"; }, 300);

    dEmojiPanel?.classList.remove("ep-open");
    mEmojiPanel?.classList.remove("ep-open");
  }

  /* ════════════════════════════════════════════════════════
     CONTROLS
  ════════════════════════════════════════════════════════ */
  function toggleMic() {
    if (!localStream) return;
    micOn = !micOn;
    localStream.getAudioTracks().forEach(t => { t.enabled = micOn; });
    updateCtrlIcons();
  }

  function toggleCam() {
    if (!localStream) return;
    camOn = !camOn;
    localStream.getVideoTracks().forEach(t => { t.enabled = camOn; });
    [dLocalTile, mLocalTile].forEach(t => t?.classList.toggle("cam-off", !camOn));
    updateCtrlIcons();
  }

  function updateCtrlIcons() {
    /* Mic buttons */
    [[dMicBtn, micOn], [mMicBtn, micOn]].forEach(([btn, on]) => {
      if (!btn) return;
      btn.classList.toggle("off", !on);
      btn.title = on ? "Mute" : "Unmute";
      btn.innerHTML = on
        ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
        : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
    });

    /* Cam buttons */
    [[dCamBtn, camOn], [mCamBtn, camOn]].forEach(([btn, on]) => {
      if (!btn) return;
      btn.classList.toggle("off", !on);
      btn.title = on ? "Camera off" : "Camera on";
      btn.innerHTML = on
        ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`
        : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/></svg>`;
    });
  }

  function endLocal() {
    S.emit("vcEnd");
    cleanup();
  }

  function cleanup() {
    callActive = false;
    localStream?.getTracks().forEach(t => t.stop());
    localStream = null;
    if (pc) { pc.close(); pc = null; }
    [dLocalVideo, dRemoteVideo, mLocalVideo, mRemoteVideo]
      .forEach(v => { if (v) v.srcObject = null; });
    [dLocalTile, mLocalTile, dRemoteTile, mRemoteTile]
      .forEach(t => t?.classList.remove("cam-off"));
    clearTimeout(emojiTimer);
    hideCallScreen();
  }

  /* ════════════════════════════════════════════════════════
     EMOJI SYSTEM
  ════════════════════════════════════════════════════════ */
  function buildEmojiPanels() {
    if (typeof EMOJI_PACK === "undefined") return;
    if (dEmojiPanel) buildGrid(dEmojiPanel);
    if (mEmojiPanel) {
      /* drag handle already in HTML */
      buildGrid(mEmojiPanel, true);
    }
  }

  function buildGrid(container, mobile = false) {
    /* Remove old content except drag handle */
    const handle = container.querySelector(".ep-handle");
    container.innerHTML = "";
    if (handle) container.appendChild(handle);

    const recents = getRecents();
    if (recents.length) {
      const sec = document.createElement("div");
      sec.className = "ep-recents";
      sec.innerHTML = `<span class="ep-section-lbl">Recently used</span><div class="ep-row"></div>`;
      recents.forEach(e => sec.querySelector(".ep-row").appendChild(makeBtn(e, container)));
      container.appendChild(sec);
    }

    const scroll = document.createElement("div");
    scroll.className = "ep-scroll";
    Object.entries(EMOJI_PACK).forEach(([cat, emojis]) => {
      const lbl = document.createElement("span");
      lbl.className = "ep-cat-lbl";
      lbl.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      scroll.appendChild(lbl);
      const grid = document.createElement("div");
      grid.className = "ep-grid";
      emojis.forEach(e => grid.appendChild(makeBtn(e, container)));
      scroll.appendChild(grid);
    });
    container.appendChild(scroll);
  }

  function makeBtn(emoji, panel) {
    const b = document.createElement("button");
    b.className   = "ep-btn";
    b.textContent = emoji;
    b.addEventListener("click", () => {
      panel.classList.remove("ep-open");
      dEmojiPanel?.classList.remove("ep-open");
      mEmojiPanel?.classList.remove("ep-open");
      sendEmoji(emoji);
    });
    return b;
  }

  function sendEmoji(emoji) {
    if (!callActive) return;
    S.emit("vcEmoji", { emoji });
    showEmojiOverlay(emoji, true);
    saveRecent(emoji);
    setTimeout(buildEmojiPanels, 60);
  }

  function showEmojiOverlay(emoji, isSelf) {
    const mobile = window.innerWidth <= 700;

    if (mobile) {
      /* both self and partner show on stranger tile corner */
      const el = mEmojiFloat;
      if (!el) return;
      el.textContent = emoji;
      el.classList.remove("show");
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
      clearTimeout(emojiTimer);
      emojiTimer = setTimeout(() => el.classList.remove("show"), EMOJI_TTL);
    } else {
      const el = dEmojiFloat;
      if (!el) return;
      el.textContent = emoji;
      el.classList.remove("show");
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
      clearTimeout(emojiTimer);
      emojiTimer = setTimeout(() => el.classList.remove("show"), EMOJI_TTL);
    }
  }

  function getRecents() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
    catch { return []; }
  }

  function saveRecent(emoji) {
    let r = getRecents().filter(e => e !== emoji);
    r.unshift(emoji);
    localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, MAX_REC)));
  }

  /* ════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════ */
  function toast(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type);
  }

})();
