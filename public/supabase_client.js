/**
 * supabase_client.js  —  Strangr Social
 * ───────────────────────────────────────
 * HOW TO CONFIGURE:
 *   1. Go to supabase.com → your project → Settings → API
 *   2. Copy "Project URL" and "anon public" key
 *   3. Paste them below
 *
 * This file is loaded AFTER socket.io and script.js,
 * so it never blocks the anonymous chat from starting.
 */

const SUPABASE_URL  = "https://otjtydxwvlfhfwretpaa.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90anR5ZHh3dmxmaGZ3cmV0cGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTc2MzIsImV4cCI6MjA5MTQ5MzYzMn0.HAjLuhtdo62LBrYLVJZvODxbf7jQPghoKGs6jXOl-JY";

// Supabase JS v2 is loaded via CDN in index.html (defer)
// window.supabase is set by the CDN script before this runs
const _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,       // keeps user logged in across reloads
    autoRefreshToken: true,
    detectSessionInUrl: true,   // handles magic-link / OAuth redirects
  }
});

// Export as window.db so auth.js and profile.js can use it
window.db = _supa;

// ── Auth state cache (updated by onAuthStateChange) ────────────────────────
window.authUser    = null;   // raw Supabase auth user object
window.authProfile = null;   // profile row from `profiles` table

// ── Bootstrap: check session on page load ──────────────────────────────────
(async function bootstrap() {
  const { data: { session } } = await _supa.auth.getSession();
  if (session?.user) {
    window.authUser = session.user;
    await loadProfile(session.user.id);
  }
  // Render nav regardless (shows login btn if no session)
  if (typeof window.renderAuthNav === "function") window.renderAuthNav();
})();

// ── Listen for auth changes (login / logout / token refresh) ───────────────
_supa.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    window.authUser = session.user;
    await loadProfile(session.user.id);
    if (typeof window.renderAuthNav === "function") window.renderAuthNav();
    if (typeof window.onAuthSignedIn  === "function") window.onAuthSignedIn();
  }
  if (event === "SIGNED_OUT") {
    window.authUser    = null;
    window.authProfile = null;
    if (typeof window.renderAuthNav    === "function") window.renderAuthNav();
    if (typeof window.onAuthSignedOut  === "function") window.onAuthSignedOut();
  }
});

// ── Load profile row from Supabase ─────────────────────────────────────────
async function loadProfile(userId) {
  const { data, error } = await _supa
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (data) {
    window.authProfile = data;
  } else if (error?.code === "PGRST116") {
    // Row doesn't exist yet — new user, profile will be created in auth.js
    window.authProfile = null;
  }
  return data;
}

window.loadProfile = loadProfile;