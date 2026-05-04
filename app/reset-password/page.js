'use client'
import { useState } from 'react'
import Link from 'next/link'
import NavLogo from '@/components/NavLogo'
import { createClient } from '@/lib/supabase'
import styles from './reset.module.css'

function StrangrIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="14" cy="14" r="10" stroke="white" strokeWidth="3" fill="none"/>
      <circle cx="26" cy="26" r="10" stroke="white" strokeWidth="3" fill="none"/>
    </svg>
  )
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password/confirm` }
    )

    setLoading(false)
    if (resetErr) {
      setError(resetErr.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      {/* ── TOP BAR ── */}
      <div className={styles.topbar}>
        <NavLogo />
        <Link href="/login" className={styles.closeBtn}>CLOSE ×</Link>
      </div>

      <main className={styles.main}>
        <div className={styles.card}>
          {!sent ? (
            <>
              {/* ── KEY ICON ── */}
              <div className={styles.iconWrap}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CDFF50" strokeWidth="1.8">
                  <circle cx="7.5" cy="15.5" r="5.5"/>
                  <path d="m21 2-9.6 9.6M15.5 7.5l3 3"/>
                </svg>
              </div>

              <h1 className={styles.heading}>Reset your password.</h1>
              <p className={styles.sub}>
                Enter the email you signed up with.<br />
                We'll send you a link to set a new one.
              </p>

              {error && <div className={styles.error}>{error}</div>}

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>EMAIL ADDRESS</label>
                  <div className={styles.inputWrap}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    <input
                      type="email"
                      placeholder="you@quiet.io"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'SENDING...' : 'SEND RESET LINK'} {!loading && '→'}
                </button>
              </form>

              <p className={styles.backHint}>
                Remember it?{' '}
                <Link href="/login" className={styles.backLink}>Back to login</Link>
              </p>
            </>
          ) : (
            /* ── SUCCESS STATE ── */
            <div className={styles.successState}>
              <div className={styles.successIconWrap}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#CDFF50" strokeWidth="2">
                  <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  <path d="m16 19 2 2 4-4"/>
                </svg>
              </div>
              <h1 className={styles.heading}>Check your inbox.</h1>
              <p className={styles.sub}>
                We sent a reset link to<br />
                <strong className={styles.emailHighlight}>{email}</strong>
              </p>
              <p className={styles.subNote}>
                The link expires in 1 hour.<br />
                If you don't see it, check your spam folder.
              </p>
              <Link href="/login" className={styles.backBtn}>
                ← Back to login
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
