/**
 * supabase_client.js  —  Strangr Social
 * ───────────────────────────────────────
 * HOW TO CONFIGURE:
 *   1. Go to supabase.com → your project → Settings → API
 *   2. Copy "Project URL" and "anon public" key
 *   3. Paste them below
 */

const SUPABASE_URL  = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON = "YOUR_ANON_PUBLIC_KEY";

const _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,   // keeps session in localStorage across reloads
    autoRefreshToken:  true,
    detectSessionInUrl:true,
  }
});

window.db          = _supa;
window.authUser    = null;
window.authProfile = null;

// ── authReady: a Promise that resolves once the initial session check is done ──
// profile.js waits on this so there's no race condition
let _resolveAuthReady;
window.authReady = new Promise(resolve => { _resolveAuthReady = resolve; });

// ── Internal: call renderAuthNav safely (retries until auth.js has loaded it) ──
function _renderNav() {
  if (typeof window.renderAuthNav === "function") {
    window.renderAuthNav();
  } else {
    // auth.js hasn't defined it yet — retry in 50ms
    setTimeout(_renderNav, 50);
  }
}

// ── Load profile from Supabase ─────────────────────────────────────────────────
async function loadProfile(userId) {
  const { data, error } = await _supa
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (data) {
    window.authProfile = data;
  } else {
    window.authProfile = null;
    if (error && error.code !== "PGRST116") {
      console.warn("[auth] loadProfile error:", error.message);
    }
  }
  return data || null;
}
window.loadProfile = loadProfile;

// ── onAuthStateChange — handles ALL auth events including page-refresh restore ─
// Supabase fires:
//   INITIAL_SESSION  — on every page load (session from localStorage or null)
//   SIGNED_IN        — after login
//   SIGNED_OUT       — after logout
//   TOKEN_REFRESHED  — silent token refresh
_supa.auth.onAuthStateChange(async (event, session) => {
  if (event === "INITIAL_SESSION") {
    // This fires on every page load — it's the restored session (or null)
    if (session?.user) {
      window.authUser = session.user;
      await loadProfile(session.user.id);
    } else {
      window.authUser    = null;
      window.authProfile = null;
    }
    _resolveAuthReady(); // unblock profile.js waitForAuth()
    _renderNav();
    return;
  }

  if (event === "SIGNED_IN") {
    window.authUser = session.user;
    await loadProfile(session.user.id);
    _renderNav();
    if (typeof window.onAuthSignedIn === "function") window.onAuthSignedIn();
    return;
  }

  if (event === "SIGNED_OUT") {
    window.authUser    = null;
    window.authProfile = null;
    _renderNav();
    if (typeof window.onAuthSignedOut === "function") window.onAuthSignedOut();
    return;
  }

  if (event === "TOKEN_REFRESHED" && session?.user) {
    window.authUser = session.user;
    // Don't reload profile on every token refresh — it's already loaded
    if (!window.authProfile) await loadProfile(session.user.id);
    return;
  }

  if (event === "USER_UPDATED" && session?.user) {
    window.authUser = session.user;
    await loadProfile(session.user.id);
    _renderNav();
    return;
  }
});