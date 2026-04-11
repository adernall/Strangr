/**
 * auth.js  —  Strangr Social: Authentication
 * ────────────────────────────────────────────
 * Fixes applied:
 *  - Signup uses user_metadata to store username/display_name
 *    so a DB trigger can create the profile row even after email confirmation
 *  - Signup detects email-confirmation-required case and shows correct message
 *  - renderAuthNav always shows username/display_name, not email
 *  - Widget creation is idempotent (safe to call multiple times)
 */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  injectAuthModal();
  injectNavAuthWidget();
});

// ══════════════════════════════════════════════════════════════════════════════
// NAV AUTH WIDGET
// ══════════════════════════════════════════════════════════════════════════════
function injectNavAuthWidget() {
  if (document.getElementById("navAuthWidget")) return; // already injected
  const navRight = document.querySelector(".nav-right");
  if (!navRight) return;
  const w = document.createElement("div");
  w.id = "navAuthWidget";
  w.style.cssText = "display:flex;align-items:center;gap:8px;margin-left:12px;";
  navRight.appendChild(w);
}

window.renderAuthNav = function renderAuthNav() {
  // Ensure widget exists (profile.html creates it differently)
  const widget = document.getElementById("navAuthWidget");
  if (!widget) return;

  const user    = window.authUser;
  const profile = window.authProfile;

  if (!user) {
    widget.innerHTML = `<button class="nav-auth-btn" id="btnOpenAuth">Sign in</button>`;
    document.getElementById("btnOpenAuth")
      ?.addEventListener("click", () => openAuthModal("login"));
    return;
  }

  // --- Logged in ---
  // Show display_name or username — NEVER email
  const displayName = profile?.display_name
    || profile?.username
    || user.user_metadata?.display_name
    || user.user_metadata?.username
    || "Profile";

  const initial = displayName.charAt(0).toUpperCase();

  const avatarHtml = profile?.avatar_url
    ? `<img src="${escH(profile.avatar_url)}" class="nav-avatar-img" alt=""/>`
    : `<div class="nav-avatar-placeholder">${initial}</div>`;

  widget.innerHTML = `
    <div class="nav-user-wrap" id="navUserWrap">
      <button class="nav-user-btn" id="btnNavUser" aria-expanded="false">
        <div class="nav-avatar">${avatarHtml}</div>
        <span class="nav-username">${escH(displayName)}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="nav-user-dropdown hidden" id="navUserDropdown">
        <div class="nud-header">
          <div class="nud-avatar">${avatarHtml}</div>
          <div>
            <div class="nud-name">${escH(displayName)}</div>
            <div class="nud-email">${escH(user.email || "")}</div>
          </div>
        </div>
        <div class="nud-divider"></div>
        <a class="nud-item" href="/profile.html">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          My Profile
        </a>
        <div class="nud-divider"></div>
        <button class="nud-item nud-signout" id="nudSignOut">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </div>`;

  document.getElementById("btnNavUser")?.addEventListener("click", e => {
    e.stopPropagation();
    const dd = document.getElementById("navUserDropdown");
    if (!dd) return;
    const open = !dd.classList.contains("hidden");
    dd.classList.toggle("hidden", open);
    document.getElementById("btnNavUser")?.setAttribute("aria-expanded", String(!open));
  });

  // Single delegated outside-click listener (use once to avoid accumulating)
  document.addEventListener("click", _closeNavDropdown);

  document.getElementById("nudSignOut")?.addEventListener("click", async () => {
    await window.db.auth.signOut();
    if (typeof window.showToast === "function") window.showToast("Signed out.", "success");
  });
};

function _closeNavDropdown(e) {
  const dd = document.getElementById("navUserDropdown");
  if (!dd || dd.classList.contains("hidden")) return;
  if (!document.getElementById("navUserWrap")?.contains(e.target)) {
    dd.classList.add("hidden");
    document.getElementById("btnNavUser")?.setAttribute("aria-expanded", "false");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH MODAL
// ══════════════════════════════════════════════════════════════════════════════
function injectAuthModal() {
  if (document.getElementById("authModal")) return;
  const div = document.createElement("div");
  div.innerHTML = `
<div class="auth-overlay hidden" id="authModal" role="dialog" aria-modal="true">
  <div class="auth-box">
    <button class="auth-close" id="authClose">✕</button>
    <div class="auth-logo">Strangr</div>
    <div class="auth-tabs">
      <button class="auth-tab active" data-tab="login">Sign in</button>
      <button class="auth-tab"        data-tab="signup">Create account</button>
    </div>

    <!-- LOGIN -->
    <form class="auth-form" id="loginForm" autocomplete="on">
      <div class="auth-field">
        <label class="auth-label" for="loginEmail">Email</label>
        <input class="auth-input" id="loginEmail" type="email" placeholder="you@email.com" autocomplete="email" required/>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="loginPassword">Password</label>
        <input class="auth-input" id="loginPassword" type="password" placeholder="••••••••" autocomplete="current-password" required/>
      </div>
      <div class="auth-error hidden" id="loginError"></div>
      <button class="auth-submit" type="submit" id="loginSubmit">
        <span id="loginBtnText">Sign in</span>
        <span class="auth-spinner hidden" id="loginSpinner"></span>
      </button>
      <p class="auth-switch">No account? <button type="button" class="auth-switch-btn" data-switch="signup">Create one →</button></p>
    </form>

    <!-- SIGNUP -->
    <form class="auth-form hidden" id="signupForm" autocomplete="on">
      <div class="auth-field">
        <label class="auth-label" for="signupEmail">Email</label>
        <input class="auth-input" id="signupEmail" type="email" placeholder="you@email.com" autocomplete="email" required/>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="signupPassword">Password</label>
        <input class="auth-input" id="signupPassword" type="password" placeholder="Min. 6 characters" autocomplete="new-password" required minlength="6"/>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="signupUsername">Username</label>
        <div class="auth-input-prefix-wrap">
          <span class="auth-input-prefix">@</span>
          <input class="auth-input auth-input-prefix" id="signupUsername" type="text" placeholder="yourhandle" maxlength="20" required/>
        </div>
        <div class="auth-hint">3–20 chars, letters / numbers / underscore</div>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="signupDisplayName">Display name</label>
        <input class="auth-input" id="signupDisplayName" type="text" placeholder="How you appear to others" maxlength="40" required/>
      </div>
      <div class="auth-error hidden" id="signupError"></div>
      <button class="auth-submit" type="submit" id="signupSubmit">
        <span id="signupBtnText">Create account</span>
        <span class="auth-spinner hidden" id="signupSpinner"></span>
      </button>
      <p class="auth-switch">Have an account? <button type="button" class="auth-switch-btn" data-switch="login">Sign in →</button></p>
    </form>

    <!-- SUCCESS (shown after signup when email confirmation is needed) -->
    <div class="auth-success-panel hidden" id="signupSuccessPanel">
      <div class="auth-success-icon">✉️</div>
      <h3 class="auth-success-title">Check your email</h3>
      <p class="auth-success-body" id="signupSuccessEmail"></p>
      <p class="auth-success-sub">Click the link in the email to confirm your account, then come back and sign in.</p>
      <button class="auth-submit" id="btnBackToLogin" type="button">Back to Sign in</button>
    </div>

  </div>
</div>`;
  document.body.appendChild(div.firstElementChild);
  bindAuthModal();
}

function bindAuthModal() {
  document.getElementById("authModal")?.addEventListener("click", e => {
    if (e.target.id === "authModal") closeAuthModal();
  });
  document.getElementById("authClose")?.addEventListener("click", closeAuthModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAuthModal(); });

  document.querySelectorAll(".auth-tab").forEach(t =>
    t.addEventListener("click", () => switchAuthTab(t.dataset.tab)));
  document.querySelectorAll(".auth-switch-btn").forEach(b =>
    b.addEventListener("click", () => switchAuthTab(b.dataset.switch)));

  document.getElementById("loginForm")?.addEventListener("submit",  handleLogin);
  document.getElementById("signupForm")?.addEventListener("submit", handleSignup);
  document.getElementById("btnBackToLogin")?.addEventListener("click", () => switchAuthTab("login"));

  document.getElementById("signupUsername")?.addEventListener("input", e => {
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
  });
}

function openAuthModal(tab = "login") {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  switchAuthTab(tab);
  setTimeout(() => {
    modal.querySelector(tab === "login" ? "#loginEmail" : "#signupEmail")?.focus();
  }, 80);
}

function closeAuthModal() {
  document.getElementById("authModal")?.classList.add("hidden");
  clearAuthErrors();
}

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === tab));
  document.getElementById("loginForm")?.classList.toggle("hidden",        tab !== "login");
  document.getElementById("signupForm")?.classList.toggle("hidden",       tab !== "signup");
  document.getElementById("signupSuccessPanel")?.classList.add("hidden");
  clearAuthErrors();
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  if (!email || !password) return;

  setLoading("login", true);
  clearAuthErrors();

  const { error } = await window.db.auth.signInWithPassword({ email, password });
  setLoading("login", false);

  if (error) {
    showErr("login", friendlyError(error.message));
  } else {
    closeAuthModal();
    if (typeof window.showToast === "function") window.showToast("Welcome back!", "success");
  }
}

// ── SIGNUP ────────────────────────────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  const email       = document.getElementById("signupEmail")?.value.trim();
  const password    = document.getElementById("signupPassword")?.value;
  const username    = document.getElementById("signupUsername")?.value.trim().toLowerCase();
  const displayName = document.getElementById("signupDisplayName")?.value.trim();

  if (!email || !password || !username || !displayName) return;

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    showErr("signup", "Username: 3–20 characters, letters/numbers/underscore only.");
    return;
  }

  setLoading("signup", true);
  clearAuthErrors();

  // 1. Check username availability
  const { data: taken } = await window.db
    .from("profiles").select("id").eq("username", username).maybeSingle();

  if (taken) {
    setLoading("signup", false);
    showErr("signup", "That username is already taken.");
    return;
  }

  // 2. Create auth user — store username/display_name in user_metadata
  //    This lets the DB trigger (and our code) use them even before email confirm
  const { data: authData, error: authErr } = await window.db.auth.signUp({
    email,
    password,
    options: {
      data: {
        username:     username,
        display_name: displayName,
      }
    }
  });

  if (authErr) {
    setLoading("signup", false);
    showErr("signup", friendlyError(authErr.message));
    return;
  }

  const userId  = authData.user?.id;
  const session = authData.session; // null if email confirmation required

  setLoading("signup", false);

  if (!userId) {
    showErr("signup", "Something went wrong. Please try again.");
    return;
  }

  if (!session) {
    // ── Email confirmation required ──────────────────────────────────────────
    // Store profile data in localStorage so we can create it after confirm
    localStorage.setItem("strangr_pending_profile", JSON.stringify({
      id: userId, username, display_name: displayName, bio: "", avatar_url: ""
    }));

    // Show "check your email" panel
    document.getElementById("loginForm")?.classList.add("hidden");
    document.getElementById("signupForm")?.classList.add("hidden");
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    const panel = document.getElementById("signupSuccessPanel");
    if (panel) panel.classList.remove("hidden");
    const msgEl = document.getElementById("signupSuccessEmail");
    if (msgEl) msgEl.textContent = `We sent a confirmation link to ${email}`;
    return;
  }

  // ── Session available (email confirmation disabled in Supabase) ──────────
  // Create profile row immediately
  await _createProfile({ id: userId, username, display_name: displayName });
  closeAuthModal();
  if (typeof window.showToast === "function") {
    window.showToast("Account created! Welcome to Strangr.", "success");
  }
}

// ── Create profile row ─────────────────────────────────────────────────────────
async function _createProfile({ id, username, display_name }) {
  const { error } = await window.db.from("profiles").upsert({
    id, username, display_name, bio: "", avatar_url: ""
  }, { onConflict: "id" });
  if (error) console.error("[auth] _createProfile error:", error.message);
}

// ── On SIGNED_IN: check if we have a pending profile to create ────────────────
// This runs after email confirmation → user clicks confirm link → lands back on site
window.onAuthSignedIn = async function () {
  const pending = localStorage.getItem("strangr_pending_profile");
  if (pending && window.authUser) {
    try {
      const data = JSON.parse(pending);
      if (data.id === window.authUser.id) {
        await _createProfile(data);
        localStorage.removeItem("strangr_pending_profile");
        await window.loadProfile(window.authUser.id);
        if (typeof window.renderAuthNav === "function") window.renderAuthNav();
      }
    } catch {}
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(form, on) {
  const btn  = document.getElementById(`${form}Submit`);
  const text = document.getElementById(`${form}BtnText`);
  const spin = document.getElementById(`${form}Spinner`);
  if (btn)  btn.disabled = on;
  if (text) text.style.opacity = on ? "0.5" : "1";
  if (spin) spin.classList.toggle("hidden", !on);
}

function showErr(form, msg) {
  const el = document.getElementById(`${form}Error`);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearAuthErrors() {
  ["loginError","signupError"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.classList.add("hidden"); }
  });
}

function friendlyError(msg) {
  if (!msg) return "Something went wrong.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid email or password"))
    return "Wrong email or password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first, then sign in.";
  if (m.includes("already registered") || m.includes("user already exists"))
    return "An account with this email already exists.";
  if (m.includes("password") && m.includes("6"))
    return "Password must be at least 6 characters.";
  if (m.includes("rate limit"))
    return "Too many attempts. Please wait a moment.";
  return msg;
}

function escH(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

window.openAuthModal  = openAuthModal;
window.closeAuthModal = closeAuthModal;