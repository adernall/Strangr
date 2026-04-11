/**
 * auth.js  —  Strangr Social: Authentication
 * ────────────────────────────────────────────
 * Handles:
 *   - Login / Signup modal
 *   - Profile creation on first signup
 *   - Nav auth widget (login btn ↔ avatar + dropdown)
 *   - Logout
 *
 * Depends on: window.db (from supabase_client.js)
 * Zero impact on script.js or anonymous chat
 */

"use strict";

// ── Wait for DOM ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  injectAuthModal();
  injectNavAuthWidget();
  // renderAuthNav is called by supabase_client.js after session check
});

// ══════════════════════════════════════════════════════════════════════════════
// NAV AUTH WIDGET
// Injected into .nav-right alongside the existing live-pill
// ══════════════════════════════════════════════════════════════════════════════
function injectNavAuthWidget() {
  const navRight = document.querySelector(".nav-right");
  if (!navRight) return;

  const widget = document.createElement("div");
  widget.id = "navAuthWidget";
  widget.style.display = "flex";
  widget.style.alignItems = "center";
  widget.style.gap = "8px";
  widget.style.marginLeft = "12px";
  navRight.appendChild(widget);
}

// Called by supabase_client.js whenever auth state changes
window.renderAuthNav = function renderAuthNav() {
  const widget = document.getElementById("navAuthWidget");
  if (!widget) return;

  const user    = window.authUser;
  const profile = window.authProfile;

  if (!user) {
    // Not logged in → show "Sign in" button
    widget.innerHTML = `
      <button class="nav-auth-btn" id="btnOpenAuth">
        Sign in
      </button>
    `;
    document.getElementById("btnOpenAuth")
      ?.addEventListener("click", () => openAuthModal("login"));

  } else {
    // Logged in → show avatar + username + dropdown
    const avatarHtml = profile?.avatar_url
      ? `<img src="${escH(profile.avatar_url)}" class="nav-avatar-img" alt="avatar"/>`
      : `<div class="nav-avatar-placeholder">${getInitial(profile)}</div>`;

    const displayName = profile?.display_name || profile?.username || user.email?.split("@")[0] || "You";

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
          <a class="nud-item" href="/profile.html" id="nudProfile">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            My Profile
          </a>
          <div class="nud-divider"></div>
          <button class="nud-item nud-signout" id="nudSignOut">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </div>
    `;

    // Toggle user dropdown
    document.getElementById("btnNavUser")?.addEventListener("click", e => {
      e.stopPropagation();
      const dd = document.getElementById("navUserDropdown");
      const btn = document.getElementById("btnNavUser");
      if (!dd) return;
      const open = !dd.classList.contains("hidden");
      dd.classList.toggle("hidden", open);
      btn?.setAttribute("aria-expanded", String(!open));
    });

    // Close on outside click
    document.addEventListener("click", e => {
      const dd = document.getElementById("navUserDropdown");
      if (dd && !dd.classList.contains("hidden") &&
          !document.getElementById("navUserWrap")?.contains(e.target)) {
        dd.classList.add("hidden");
        document.getElementById("btnNavUser")?.setAttribute("aria-expanded", "false");
      }
    }, { capture: false });

    // Sign out
    document.getElementById("nudSignOut")?.addEventListener("click", async () => {
      await window.db.auth.signOut();
      if (typeof window.showToast === "function") window.showToast("Signed out.", "success");
    });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// AUTH MODAL
// ══════════════════════════════════════════════════════════════════════════════
function injectAuthModal() {
  if (document.getElementById("authModal")) return;

  const el = document.createElement("div");
  el.innerHTML = `
<div class="auth-overlay hidden" id="authModal" role="dialog" aria-modal="true" aria-label="Sign in">
  <div class="auth-box">

    <!-- Close -->
    <button class="auth-close" id="authClose" aria-label="Close">✕</button>

    <!-- Logo -->
    <div class="auth-logo">Strangr</div>

    <!-- Tab bar -->
    <div class="auth-tabs">
      <button class="auth-tab active" data-tab="login">Sign in</button>
      <button class="auth-tab"        data-tab="signup">Create account</button>
    </div>

    <!-- ── LOGIN FORM ── -->
    <form class="auth-form" id="loginForm" autocomplete="on">
      <div class="auth-field">
        <label class="auth-label" for="loginEmail">Email</label>
        <input class="auth-input" id="loginEmail" type="email"
               placeholder="you@email.com" autocomplete="email" required />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="loginPassword">Password</label>
        <input class="auth-input" id="loginPassword" type="password"
               placeholder="••••••••" autocomplete="current-password" required />
      </div>
      <div class="auth-error hidden" id="loginError"></div>
      <button class="auth-submit" type="submit" id="loginSubmit">
        <span id="loginBtnText">Sign in</span>
        <span class="auth-spinner hidden" id="loginSpinner"></span>
      </button>
      <p class="auth-switch">
        No account?
        <button type="button" class="auth-switch-btn" data-switch="signup">Create one →</button>
      </p>
    </form>

    <!-- ── SIGNUP FORM ── -->
    <form class="auth-form hidden" id="signupForm" autocomplete="on">
      <div class="auth-field">
        <label class="auth-label" for="signupEmail">Email</label>
        <input class="auth-input" id="signupEmail" type="email"
               placeholder="you@email.com" autocomplete="email" required />
      </div>
      <div class="auth-field">
        <label class="auth-label" for="signupPassword">Password</label>
        <input class="auth-input" id="signupPassword" type="password"
               placeholder="Min. 6 characters" autocomplete="new-password" required minlength="6"/>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="signupUsername">Username</label>
        <div class="auth-input-prefix-wrap">
          <span class="auth-input-prefix">@</span>
          <input class="auth-input auth-input-prefix" id="signupUsername" type="text"
                 placeholder="yourhandle" autocomplete="off"
                 pattern="[a-zA-Z0-9_]{3,20}" maxlength="20" required />
        </div>
        <div class="auth-hint">3–20 chars, letters/numbers/underscore only</div>
      </div>
      <div class="auth-field">
        <label class="auth-label" for="signupDisplayName">Display name</label>
        <input class="auth-input" id="signupDisplayName" type="text"
               placeholder="How you appear to others" maxlength="40" required />
      </div>
      <div class="auth-error hidden" id="signupError"></div>
      <button class="auth-submit" type="submit" id="signupSubmit">
        <span id="signupBtnText">Create account</span>
        <span class="auth-spinner hidden" id="signupSpinner"></span>
      </button>
      <p class="auth-switch">
        Have an account?
        <button type="button" class="auth-switch-btn" data-switch="login">Sign in →</button>
      </p>
    </form>

  </div>
</div>`;
  document.body.appendChild(el.firstElementChild);
  bindAuthModal();
}

function bindAuthModal() {
  // Close on backdrop click
  document.getElementById("authModal")?.addEventListener("click", e => {
    if (e.target.id === "authModal") closeAuthModal();
  });
  document.getElementById("authClose")?.addEventListener("click", closeAuthModal);

  // Escape key
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeAuthModal();
  });

  // Tab switching
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => switchAuthTab(tab.dataset.tab));
  });
  document.querySelectorAll(".auth-switch-btn").forEach(btn => {
    btn.addEventListener("click", () => switchAuthTab(btn.dataset.switch));
  });

  // Forms
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
  document.getElementById("signupForm")?.addEventListener("submit", handleSignup);

  // Username: auto-lowercase, strip invalid chars
  document.getElementById("signupUsername")?.addEventListener("input", e => {
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
  });
}

function openAuthModal(tab = "login") {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  switchAuthTab(tab);
  // Focus first input
  setTimeout(() => {
    const input = modal.querySelector(`#${tab === "login" ? "loginEmail" : "signupEmail"}`);
    input?.focus();
  }, 80);
}

function closeAuthModal() {
  document.getElementById("authModal")?.classList.add("hidden");
  clearAuthErrors();
}

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
  document.getElementById("loginForm")?.classList.toggle("hidden", tab !== "login");
  document.getElementById("signupForm")?.classList.toggle("hidden", tab !== "signup");
  clearAuthErrors();
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  if (!email || !password) return;

  setAuthLoading("login", true);
  clearAuthErrors();

  const { error } = await window.db.auth.signInWithPassword({ email, password });

  setAuthLoading("login", false);

  if (error) {
    showAuthError("login", friendlyAuthError(error.message));
  } else {
    closeAuthModal();
    if (typeof window.showToast === "function") window.showToast("Welcome back!", "success");
  }
}

// ── Signup ────────────────────────────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  const email       = document.getElementById("signupEmail")?.value.trim();
  const password    = document.getElementById("signupPassword")?.value;
  const username    = document.getElementById("signupUsername")?.value.trim().toLowerCase();
  const displayName = document.getElementById("signupDisplayName")?.value.trim();

  if (!email || !password || !username || !displayName) return;

  // Check username format
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    showAuthError("signup", "Username must be 3–20 characters: letters, numbers, underscore only.");
    return;
  }

  setAuthLoading("signup", true);
  clearAuthErrors();

  // Check username availability before creating auth user
  const { data: existing } = await window.db
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    setAuthLoading("signup", false);
    showAuthError("signup", "That username is already taken.");
    return;
  }

  // Create auth user
  const { data: authData, error: authErr } = await window.db.auth.signUp({ email, password });

  if (authErr) {
    setAuthLoading("signup", false);
    showAuthError("signup", friendlyAuthError(authErr.message));
    return;
  }

  const userId = authData.user?.id;
  if (!userId) {
    setAuthLoading("signup", false);
    showAuthError("signup", "Something went wrong. Please try again.");
    return;
  }

  // Create profile row
  const { error: profileErr } = await window.db.from("profiles").insert({
    id:           userId,
    username:     username,
    display_name: displayName,
    bio:          "",
    avatar_url:   "",
  });

  setAuthLoading("signup", false);

  if (profileErr) {
    // Auth user was created but profile failed — show useful message
    showAuthError("signup", "Account created but profile setup failed. Please contact support.");
    return;
  }

  closeAuthModal();
  if (typeof window.showToast === "function") {
    window.showToast("Account created! Welcome to Strangr.", "success");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setAuthLoading(form, loading) {
  const btn     = document.getElementById(`${form}Submit`);
  const text    = document.getElementById(`${form}BtnText`);
  const spinner = document.getElementById(`${form}Spinner`);
  if (btn)     btn.disabled    = loading;
  if (text)    text.style.opacity  = loading ? "0.5" : "1";
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

function showAuthError(form, msg) {
  const el = document.getElementById(`${form}Error`);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearAuthErrors() {
  ["loginError", "signupError"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.classList.add("hidden"); }
  });
}

function friendlyAuthError(msg) {
  if (!msg) return "Something went wrong.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Wrong email or password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first.";
  if (m.includes("already registered") || m.includes("user already exists"))
    return "An account with this email already exists.";
  if (m.includes("password"))
    return "Password must be at least 6 characters.";
  return msg;
}

function getInitial(profile) {
  const name = profile?.display_name || profile?.username || "?";
  return name.charAt(0).toUpperCase();
}

function escH(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// Expose for other modules
window.openAuthModal  = openAuthModal;
window.closeAuthModal = closeAuthModal;