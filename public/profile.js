/**
 * profile.js  —  Strangr Social: Profile Page
 * ──────────────────────────────────────────────
 * Runs on profile.html only.
 * Handles: view profile, edit profile, avatar upload.
 */
"use strict";

// ── Toast (reuse existing style, no script.js dependency) ─────────────────────
const toastEl = document.getElementById("toast");
let _toastT;
function showToast(msg, type = "") {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = `toast show${type ? " toast-" + type : ""}`;
  clearTimeout(_toastT);
  _toastT = setTimeout(() => { toastEl.className = "toast"; }, 3500);
}
window.showToast = showToast;

// ── Theme (match main site) ────────────────────────────────────────────────────
const THEME_KEY = "strangr_theme";
const savedTheme = localStorage.getItem(THEME_KEY) || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

// ── Wait for Supabase client to be ready ──────────────────────────────────────
function waitForDb(cb, tries = 0) {
  if (window.db) return cb();
  if (tries > 30) return console.error("[profile] Supabase not loaded");
  setTimeout(() => waitForDb(cb, tries + 1), 100);
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const profileLoading    = document.getElementById("profileLoading");
const profileGate       = document.getElementById("profileGate");
const profileCard       = document.getElementById("profileCard");
const profileAvatar     = document.getElementById("profileAvatar");
const btnChangeAvatar   = document.getElementById("btnChangeAvatar");
const avatarFileInput   = document.getElementById("avatarFileInput");
const btnEditProfile    = document.getElementById("btnEditProfile");
const btnSaveProfile    = document.getElementById("btnSaveProfile");
const btnCancelEdit     = document.getElementById("btnCancelEdit");
const profileInfoView   = document.getElementById("profileInfoView");
const profileInfoEdit   = document.getElementById("profileInfoEdit");
const editDisplayName   = document.getElementById("editDisplayName");
const editUsername      = document.getElementById("editUsername");
const editBio           = document.getElementById("editBio");
const bioCharCount      = document.getElementById("bioCharCount");
const profileEditError  = document.getElementById("profileEditError");
const saveSpinner       = document.getElementById("saveSpinner");
const saveBtnText       = document.getElementById("saveBtnText");
const gateSignInBtn     = document.getElementById("gateSignInBtn");

// ── State ─────────────────────────────────────────────────────────────────────
let currentProfile = null;
let pendingAvatarFile = null;
let isEditing = false;

// ── Entry point ───────────────────────────────────────────────────────────────
waitForDb(async () => {
  // Inject nav auth widget
  const navRight = document.getElementById("profileNavRight");
  if (navRight) {
    const widget = document.createElement("div");
    widget.id = "navAuthWidget";
    widget.style.display = "flex";
    widget.style.alignItems = "center";
    navRight.appendChild(widget);
  }

  // Load auth.js dynamically (it needs DOM to be ready)
  loadScript("auth.js", () => {
    // auth.js will call renderAuthNav() automatically
  });

  // Auth state from supabase_client.js
  // It calls loadProfile() and sets window.authUser, window.authProfile
  // We hook onAuthStateChange to re-render when login state changes
  window.onAuthSignedIn = () => initProfilePage();
  window.onAuthSignedOut = () => {
    hideCard();
    showGate();
  };

  // Initial render
  if (window.authUser && window.authProfile) {
    initProfilePage();
  } else if (window.authUser && !window.authProfile) {
    // User logged in but no profile yet (edge case)
    showGate();
  } else {
    // Check session once more (supabase_client.js may not have finished)
    const { data: { session } } = await window.db.auth.getSession();
    if (session?.user) {
      const profile = await window.loadProfile(session.user.id);
      if (profile) {
        window.authUser    = session.user;
        window.authProfile = profile;
        initProfilePage();
      } else {
        showGate();
      }
    } else {
      showGate();
    }
  }
});

// ── Render profile ─────────────────────────────────────────────────────────────
function initProfilePage() {
  currentProfile = window.authProfile;
  hideLoading();
  if (!currentProfile) { showGate(); return; }
  renderProfileView();
  showCard();
  loadFriendCount();
}

function renderProfileView() {
  const p = currentProfile;
  if (!p) return;

  // Avatar
  renderAvatar(p);

  // View mode fields
  setText("viewDisplayName", p.display_name || p.username);
  setText("viewUsername",    "@" + (p.username || ""));
  setText("viewBio",         p.bio || "");
  setText("viewJoined",      "Member since " + fmtDate(p.created_at));
  setText("statMemberSince", fmtDate(p.created_at, "short"));

  // Update page title
  document.title = `@${p.username} — Strangr`;
}

function renderAvatar(p) {
  if (!profileAvatar) return;
  if (p.avatar_url) {
    profileAvatar.innerHTML = `<img src="${escH(p.avatar_url)}" alt="avatar" class="profile-avatar-img"/>`;
  } else {
    const initial = (p.display_name || p.username || "?").charAt(0).toUpperCase();
    profileAvatar.innerHTML = `<span class="profile-avatar-letter">${initial}</span>`;
  }
}

// ── Friend count ───────────────────────────────────────────────────────────────
async function loadFriendCount() {
  if (!currentProfile) return;
  const { count } = await window.db
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${currentProfile.id},addressee_id.eq.${currentProfile.id}`);

  setText("statFriends", count ?? 0);
}

// ── Edit mode ─────────────────────────────────────────────────────────────────
btnEditProfile?.addEventListener("click", enterEditMode);
btnCancelEdit?.addEventListener("click",  exitEditMode);
btnSaveProfile?.addEventListener("click", saveProfile);

function enterEditMode() {
  if (!currentProfile) return;
  isEditing = true;

  // Fill edit fields
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
}

function exitEditMode() {
  isEditing = false;
  pendingAvatarFile = null;

  profileInfoEdit?.classList.add("hidden");
  profileInfoView?.classList.remove("hidden");
  btnEditProfile?.classList.remove("hidden");
  btnSaveProfile?.classList.add("hidden");
  btnCancelEdit?.classList.add("hidden");
  btnChangeAvatar?.classList.add("hidden");

  // Restore avatar to saved state
  renderAvatar(currentProfile);
}

// Bio char counter
editBio?.addEventListener("input", () => {
  if (bioCharCount) bioCharCount.textContent = editBio.value.length;
});

// Username: lowercase + strip invalid
editUsername?.addEventListener("input", e => {
  e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
});

// ── Save profile ──────────────────────────────────────────────────────────────
async function saveProfile() {
  if (!currentProfile) return;

  const newDisplayName = editDisplayName?.value.trim();
  const newUsername    = editUsername?.value.trim().toLowerCase();
  const newBio         = editBio?.value.trim();

  // Validate
  if (!newDisplayName) { showEditError("Display name cannot be empty."); return; }
  if (!newUsername)     { showEditError("Username cannot be empty."); return; }
  if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
    showEditError("Username must be 3–20 characters: letters, numbers, underscore only.");
    return;
  }

  setSaveLoading(true);
  hideEditError();

  // Check username uniqueness if changed
  if (newUsername !== currentProfile.username) {
    const { data: existing } = await window.db
      .from("profiles")
      .select("id")
      .eq("username", newUsername)
      .neq("id", currentProfile.id)
      .maybeSingle();

    if (existing) {
      setSaveLoading(false);
      showEditError("That username is already taken.");
      return;
    }
  }

  // Upload avatar if pending
  let avatarUrl = currentProfile.avatar_url;
  if (pendingAvatarFile) {
    const url = await uploadAvatar(pendingAvatarFile, currentProfile.id);
    if (url) avatarUrl = url;
    else {
      setSaveLoading(false);
      showEditError("Avatar upload failed. Try a smaller image (< 2 MB).");
      return;
    }
  }

  // Update Supabase
  const { data, error } = await window.db
    .from("profiles")
    .update({
      display_name: newDisplayName,
      username:     newUsername,
      bio:          newBio,
      avatar_url:   avatarUrl,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", currentProfile.id)
    .select()
    .single();

  setSaveLoading(false);

  if (error) {
    showEditError("Failed to save. Please try again.");
    return;
  }

  // Update local state
  currentProfile         = data;
  window.authProfile     = data;

  renderProfileView();
  exitEditMode();
  showToast("Profile updated!", "success");

  // Re-render nav avatar
  if (typeof window.renderAuthNav === "function") window.renderAuthNav();
}

// ── Avatar upload ──────────────────────────────────────────────────────────────
btnChangeAvatar?.addEventListener("click", () => avatarFileInput?.click());

avatarFileInput?.addEventListener("change", () => {
  const file = avatarFileInput.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showEditError("Image too large. Max 2 MB.");
    return;
  }
  pendingAvatarFile = file;
  // Show preview immediately
  const url = URL.createObjectURL(file);
  if (profileAvatar) {
    profileAvatar.innerHTML = `<img src="${url}" alt="avatar preview" class="profile-avatar-img"/>`;
  }
});

async function uploadAvatar(file, userId) {
  const ext  = file.name.split(".").pop() || "jpg";
  const path = `avatars/${userId}/avatar.${ext}`;

  const { error } = await window.db.storage
    .from("avatars")          // Supabase Storage bucket named "avatars"
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) { console.error("[avatar] upload error:", error); return null; }

  const { data } = window.db.storage.from("avatars").getPublicUrl(path);
  // Add cache-bust so browser loads the new image
  return data?.publicUrl + "?t=" + Date.now();
}

// ── Gate (not logged in) ───────────────────────────────────────────────────────
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

function showEditError(msg) {
  if (!profileEditError) return;
  profileEditError.textContent = msg;
  profileEditError.classList.remove("hidden");
}
function hideEditError() {
  profileEditError?.classList.add("hidden");
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "";
}

function fmtDate(iso, format = "long") {
  if (!iso) return "";
  const d = new Date(iso);
  if (format === "short") return d.getFullYear().toString();
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function escH(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function loadScript(src, cb) {
  if (document.querySelector(`script[src="${src}"]`)) { cb?.(); return; }
  const s = document.createElement("script");
  s.src = src;
  s.onload = cb;
  document.body.appendChild(s);
}