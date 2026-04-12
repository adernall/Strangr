/**
 * supabase_client.js — Strangr Social
 *
 * Configure: paste your Project URL and anon key below.
 * Supabase Dashboard → Settings → API
 */

const SUPABASE_URL  = "https://otjtydxwvlfhfwretpaa.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90anR5ZHh3dmxmaGZ3cmV0cGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MTc2MzIsImV4cCI6MjA5MTQ5MzYzMn0.HAjLuhtdo62LBrYLVJZvODxbf7jQPghoKGs6jXOl-JY";

// Create client — session is automatically persisted in localStorage
const _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  }
});

window.db          = _supa;
window.authUser    = null;
window.authProfile = null;

// ── loadProfile ───────────────────────────────────────────────────────────────
async function loadProfile(userId) {
  const { data } = await _supa
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  window.authProfile = data || null;
  return data || null;
}
window.loadProfile = loadProfile;

// ── renderNav (safe wrapper — retries until auth.js defines it) ───────────────
function renderNav() {
  if (typeof window.renderAuthNav === "function") {
    window.renderAuthNav();
  } else {
    setTimeout(renderNav, 40);
  }
}

// ── MAIN INIT — use getSession(), never rely on INITIAL_SESSION event ─────────
// getSession() reads directly from localStorage — always works on refresh
(async function init() {
  try {
    const { data: { session } } = await _supa.auth.getSession();
    if (session?.user) {
      window.authUser = session.user;
      await loadProfile(session.user.id);
    }
  } catch (e) {
    console.warn("[auth] getSession failed:", e.message);
  }

  // Render nav after session is known
  renderNav();

  // Notify profile.js / any page waiting
  if (typeof window._authInitDone === "function") window._authInitDone();
  window._authIsReady = true;
})();

// ── onAuthStateChange — handles login / logout / token refresh ────────────────
_supa.auth.onAuthStateChange(async (event, session) => {
  // Skip INITIAL_SESSION — we handle it with getSession() above
  if (event === "INITIAL_SESSION") return;

  if (event === "SIGNED_IN") {
    window.authUser = session.user;
    await loadProfile(session.user.id);
    renderNav();
    if (typeof window.onAuthSignedIn === "function") window.onAuthSignedIn();
    return;
  }

  if (event === "SIGNED_OUT") {
    window.authUser    = null;
    window.authProfile = null;
    renderNav();
    if (typeof window.onAuthSignedOut === "function") window.onAuthSignedOut();
    return;
  }

  if (event === "TOKEN_REFRESHED" && session?.user) {
    window.authUser = session.user;
    if (!window.authProfile) await loadProfile(session.user.id);
    return;
  }

  if (event === "USER_UPDATED" && session?.user) {
    window.authUser = session.user;
    await loadProfile(session.user.id);
    renderNav();
    return;
  }
});
