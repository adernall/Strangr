'use client'
import { useState } from 'react'
import Link from 'next/link'
import NavLogo from '@/components/NavLogo'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { validateEmail } from '@/lib/validateEmail'
import styles from './signup.module.css'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // ── VALIDATIONS ──
    if (!form.username.trim())
      return setError('Please choose a username.')
    if (form.username.length < 3)
      return setError('Username must be at least 3 characters.')
    if (!/^[a-zA-Z0-9_]+$/.test(form.username))
      return setError('Username can only contain letters, numbers, and underscores.')

    const emailError = validateEmail(form.email)
    if (emailError) return setError(emailError)

    if (form.password.length < 8)
      return setError('Password must be at least 8 characters.')
    if (form.password !== form.confirm)
      return setError('Passwords do not match.')
    if (!agreed)
      return setError('Please agree to the Terms to continue.')

    setLoading(true)
    const supabase = createClient()

    // ── BETA CHECK ──
    const { data: settings } = await supabase
      .from('app_settings')
      .select('beta_mode_enabled')
      .single()

    if (settings?.beta_mode_enabled) {
      const { data: wl } = await supabase
        .from('waitlist')
        .select('email')
        .eq('email', form.email.toLowerCase().trim())
        .single()

      if (!wl) {
        setLoading(false)
        router.push('/signup/blocked?email=' + encodeURIComponent(form.email))
        return
      }
    }

    // ── CREATE ACCOUNT ──
    // Supabase will send verification email automatically
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: { username: form.username.trim().toLowerCase() }
      }
    })

    setLoading(false)
    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try logging in.')
      } else {
        setError(signUpError.message)
      }
    } else {
      // Go to "check your inbox" screen
      router.push('/signup/verify?email=' + encodeURIComponent(form.email.trim()))
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.topbar}>
        <NavLogo />
        <Link href="/" className={styles.closeBtn}>CLOSE ×</Link>
      </div>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.sparkleWrap}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" fill="#CDFF50"/>
            </svg>
          </div>

          <h1 className={styles.heading}>Claim your handle.</h1>
          <p className={styles.sub}>Quiet by default. Loud when it matters.</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>USERNAME</label>
              <div className={styles.inputWrap}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span className={styles.atSign}>@</span>
                <input
                  type="text"
                  placeholder="absolute_zero"
                  value={form.username}
                  onChange={set('username')}
                  className={`${styles.input} ${styles.inputWithIconAndAt}`}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>EMAIL</label>
              <div className={styles.inputWrap}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input
                  type="email"
                  placeholder="you@quiet.io"
                  value={form.email}
                  onChange={set('email')}
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label}>PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  className={styles.input}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>CONFIRM</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={set('confirm')}
                  className={styles.input}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <label className={styles.checkRow}>
              <div
                className={`${styles.checkbox} ${agreed ? styles.checkboxChecked : ''}`}
                onClick={() => setAgreed(a => !a)}
              >
                {agreed && <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>}
              </div>
              <span className={styles.checkText}>
                I agree to the <Link href="/terms" className={styles.termsLink}>Terms</Link> and acknowledge that Strangr is a quiet space.
              </span>
            </label>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'CREATING...' : 'CREATE ACCOUNT'} {!loading && '→'}
            </button>
          </form>

          <p className={styles.loginHint}>
            Already have an account? <Link href="/login" className={styles.loginLink}>Log in</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
