/**
 * profile.js — Strangr Social: Profile Page
 * Waits for supabase_client.js to finish its getSession() call,
 * then renders the page. No race conditions.
 */
"use strict";

// ── Toast ─────────────────────────────────────────────────────────────────────
const _toastEl = document.getElementById("toast");
let _toastT;
function showToast(msg, type = "") {
  if (!_toastEl) return;
  _toastEl.textContent = msg;
  _toastEl.className = `toast show${type ? " toast-" + type : ""}`;
  clearTimeout(_toastT);
  _toastT = setTimeout(() => { _toastEl.className = "toast"; }, 3500);
}
window.showToast = showToast;

// ── Theme ─────────────────────────────────────────────────────────────────────
document.documentElement.setAttribute(
  "data-theme", localStorage.getItem("strangr_theme") || "light"
);

// ── DOM refs ──────────────────────────────────────────────────────────────────
const profileLoading   = document.getElementById("profileLoading");
const profileGate      = document.getElementById("profileGate");
const profileCard      = document.getElementById("profileCard");
const profileAvatar    = document.getElementById("profileAvatar");
const btnChangeAvatar  = document.getElementById("btnChangeAvatar");
const avatarFileInput  = document.getElementById("avatarFileInput");
const btnEditProfile   = document.getElementById("btnEditProfile");
const btnSaveProfile   = document.getElementById("btnSaveProfile");
const btnCancelEdit    = document.getElementById("btnCancelEdit");
const profileInfoView  = document.getElementById("profileInfoView");
const profileInfoEdit  = document.getElementById("profileInfoEdit");
const editDisplayName  = document.getElementById("editDisplayName");
const editUsername     = document.getElementById("editUsername");
const editBio          = document.getElementById("editBio");
const bioCharCount     = document.getElementById("bioCharCount");
const profileEditError = document.getElementById("profileEditError");
const saveSpinner      = document.getElementById("saveSpinner");
const saveBtnText      = document.getElementById("saveBtnText");
const gateSignInBtn    = document.getElementById("gateSignInBtn");

let currentProfile    = null;
let pendingAvatarFile = null;

// ── Ensure nav auth widget slot exists ────────────────────────────────────────
(function ensureNavWidget() {
  const navRight = document.getElementById("profileNavRight");
  if (navRight && !document.getElementById("navAuthWidget")) {
    const w = document.createElement("div");
    w.id = "navAuthWidget";
    w.style.cssText = "display:flex;align-items:center;gap:8px;";
    navRight.appendChild(w);
  }
})();

// ── Wait for supabase_client.js init to complete, then boot ──────────────────
// supabase_client.js sets window._authIsReady = true after getSession() resolves
// and calls window._authInitDone() if defined.
// We poll for _authIsReady as a safe fallback.
function waitForAuthInit(cb, tries = 0) {
  if (window._authIsReady) return cb();
  if (tries > 60) {
    // 3 seconds max wait — something went wrong, show gate
    hideLoading(); showGate(); return;
  }
  // Register as the callback so it fires immediately when ready
  window._authInitDone = cb;
  // Also poll in case supabase_client.js already ran before this line
  setTimeout(() => {
    if (window._authIsReady && typeof window._authInitDone === "function") {
      const fn = window._authInitDone;
      window._authInitDone = null;
      fn();
    } else if (!window._authIsReady) {
      waitForAuthInit(cb, tries + 1);
    }
  }, 50);
}

waitForAuthInit(async () => {
  // supabase_client.js is done — auth state is now definitive
  window.onAuthSignedIn  = onSignedIn;
  window.onAuthSignedOut = onSignedOut;

  if (window.authUser) {
    await onSignedIn();
  } else {
    hideLoading();
    showGate();
  }
});

// ── Sign in / out handlers ────────────────────────────────────────────────────
async function onSignedIn() {
  // Handle pending profile from email-confirm flow
  const pending = localStorage.getItem("strangr_pending_profile");
  if (pending && window.authUser) {
    try {
      const data = JSON.parse(pending);
      if (data.id === window.authUser.id) {
        await window.db.from("profiles").upsert(data, { onConflict: "id" });
        localStorage.removeItem("strangr_pending_profile");
        await window.loadProfile(window.authUser.id);
      }
    } catch {}
  }

  // Reload profile to make sure it's fresh
  if (window.authUser && !window.authProfile) {
    await window.loadProfile(window.authUser.id);
  }

  currentProfile = window.authProfile;
  hideLoading();

  if (!currentProfile) {
    showGate();
    return;
  }

  renderProfileView();
  showCard();
  loadFriendCount();
  if (typeof window.renderAuthNav === "function") window.renderAuthNav();
}

function onSignedOut() {
  currentProfile = null;
  hideLoading(); hideCard(); showGate();
  if (typeof window.renderAuthNav === "function") window.renderAuthNav();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderProfileView() {
  const p = currentProfile;
  if (!p) return;
  renderAvatar(p);
  setText("viewDisplayName", p.display_name || p.username);
  setText("viewUsername",    "@" + (p.username || ""));
  setText("viewBio",         p.bio || "");
  setText("viewJoined",      "Member since " + fmtDate(p.created_at));
  setText("statMemberSince", fmtDate(p.created_at, "short"));
  document.title = `@${p.username} — Strangr`;
}

function renderAvatar(p) {
  if (!profileAvatar) return;
  if (p?.avatar_url) {
    profileAvatar.innerHTML = `<img src="${escH(p.avatar_url)}" alt="avatar" class="profile-avatar-img"/>`;
  } else {
    const letter = (p?.display_name || p?.username || "?").charAt(0).toUpperCase();
    profileAvatar.innerHTML = `<span class="profile-avatar-letter">${letter}</span>`;
  }
}

async function loadFriendCount() {
  if (!currentProfile) return;
  const { count } = await window.db
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${currentProfile.id},addressee_id.eq.${currentProfile.id}`);
  setText("statFriends", count ?? 0);
}

// ── Edit ──────────────────────────────────────────────────────────────────────
btnEditProfile?.addEventListener("click", () => {
  if (!currentProfile) return;
  if (editDisplayName) editDisplayName.value = currentProfile.display_name || "";
  if (editUsername)    editUsername.value    = currentProfile.username      || "";
  if (editBio)         editBio.value         = currentProfile.bio           || "";
  if (bioCharCount)    bioCharCount.textContent = (currentProfile.bio || "").length;
  profileInfoView?.classList.add("hidden");
  profileInfoEdit?.classList.remove("hidden");
  btnEditProfile?.classList.add("hidden");
  btnSaveProfile?.classList.remove("hidden");
  btnCancelEdit?.classList.remove("hidden");
  btnChangeAvatar?.classList.remove("hidden");
  profileEditError?.classList.add("hidden");
  pendingAvatarFile = null;
});

btnCancelEdit?.addEventListener("click", exitEditMode);

function exitEditMode() {
  pendingAvatarFile = null;
  profileInfoEdit?.classList.add("hidden");
  profileInfoView?.classList.remove("hidden");
  btnEditProfile?.classList.remove("hidden");
  btnSaveProfile?.classList.add("hidden");
  btnCancelEdit?.classList.add("hidden");
  btnChangeAvatar?.classList.add("hidden");
  renderAvatar(currentProfile);
}

editBio?.addEventListener("input", () => {
  if (bioCharCount) bioCharCount.textContent = editBio.value.length;
});
editUsername?.addEventListener("input", e => {
  e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
});

btnSaveProfile?.addEventListener("click", async () => {
  if (!currentProfile) return;
  const newDisplay  = editDisplayName?.value.trim();
  const newUsername = editUsername?.value.trim().toLowerCase();
  const newBio      = editBio?.value.trim();

  if (!newDisplay)  { showEditErr("Display name cannot be empty."); return; }
  if (!newUsername) { showEditErr("Username cannot be empty.");     return; }
  if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
    showEditErr("Username: 3–20 chars, letters/numbers/underscore."); return;
  }

  setSaveLoading(true); hideEditErr();

  if (newUsername !== currentProfile.username) {
    const { data: taken } = await window.db
      .from("profiles").select("id")
      .eq("username", newUsername).neq("id", currentProfile.id).maybeSingle();
    if (taken) { setSaveLoading(false); showEditErr("That username is taken."); return; }
  }

  let avatarUrl = currentProfile.avatar_url;
  if (pendingAvatarFile) {
    const url = await uploadAvatar(pendingAvatarFile, currentProfile.id);
    if (!url) { setSaveLoading(false); showEditErr("Avatar upload failed."); return; }
    avatarUrl = url;
  }

  const { data, error } = await window.db
    .from("profiles")
    .update({ display_name: newDisplay, username: newUsername, bio: newBio, avatar_url: avatarUrl })
    .eq("id", currentProfile.id).select().single();

  setSaveLoading(false);
  if (error) { showEditErr("Failed to save. Please try again."); return; }

  currentProfile = window.authProfile = data;
  renderProfileView(); exitEditMode();
  showToast("Profile updated!", "success");
  if (typeof window.renderAuthNav === "function") window.renderAuthNav();
});

// ── Avatar ────────────────────────────────────────────────────────────────────
btnChangeAvatar?.addEventListener("click", () => avatarFileInput?.click());
avatarFileInput?.addEventListener("change", () => {
  const file = avatarFileInput.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showEditErr("Image too large. Max 2 MB."); return; }
  pendingAvatarFile = file;
  if (profileAvatar) profileAvatar.innerHTML =
    `<img src="${URL.createObjectURL(file)}" alt="preview" class="profile-avatar-img"/>`;
});

async function uploadAvatar(file, userId) {
  const ext  = file.name.split(".").pop() || "jpg";
  const path = `avatars/${userId}/avatar.${ext}`;
  const { error } = await window.db.storage
    .from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error("[avatar]", error); return null; }
  const { data } = window.db.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl + "?t=" + Date.now();
}

// ── Gate ──────────────────────────────────────────────────────────────────────
gateSignInBtn?.addEventListener("click", () => {
  if (typeof window.openAuthModal === "function") window.openAuthModal("login");
});

// ── Visibility helpers ────────────────────────────────────────────────────────
function showCard()    { profileCard?.classList.remove("hidden"); hideLoading(); hideGate(); }
function showGate()    { profileGate?.classList.remove("hidden"); hideLoading(); hideCard(); }
function hideCard()    { profileCard?.classList.add("hidden"); }
function hideGate()    { profileGate?.classList.add("hidden"); }
function hideLoading() { profileLoading?.classList.add("hidden"); }
function setSaveLoading(on) {
  if (btnSaveProfile) btnSaveProfile.disabled = on;
  if (saveBtnText)    saveBtnText.style.opacity = on ? "0.5" : "1";
  if (saveSpinner)    saveSpinner.classList.toggle("hidden", !on);
}
function showEditErr(msg) {
  if (!profileEditError) return;
  profileEditError.textContent = msg;
  profileEditError.classList.remove("hidden");
}
function hideEditErr() { profileEditError?.classList.add("hidden"); }
function setText(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val ?? "";
}
function fmtDate(iso, fmt = "long") {
  if (!iso) return "";
  const d = new Date(iso);
  return fmt === "short"
    ? d.getFullYear().toString()
    : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function escH(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
