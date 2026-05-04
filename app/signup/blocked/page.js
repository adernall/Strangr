'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import NavLogo from '@/components/NavLogo'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { validateEmail } from '@/lib/validateEmail'
import styles from './blocked.module.css'

function BlockedContent() {
  const searchParams = useSearchParams()
  const prefillEmail = searchParams.get('email') || ''
  const [email, setEmail] = useState(prefillEmail)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(e) {
    e.preventDefault()
    setError('')

    const emailError = validateEmail(email)
    if (emailError) return setError(emailError)

    setLoading(true)
    const supabase = createClient()

    // Use upsert so duplicate emails don't throw errors
    const { error: dbError } = await supabase
      .from('waitlist_requests')
      .upsert(
        { email: email.trim().toLowerCase() },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    setLoading(false)
    // Always show success — don't expose DB errors to user
    if (dbError) console.error('waitlist_requests error:', dbError.message)
    setSubmitted(true)
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.topbar}>
        <NavLogo />
        <Link href="/" className={styles.closeBtn}>CLOSE ×</Link>
      </div>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.lockWrap}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CDFF50" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              <circle cx="12" cy="16" r="1" fill="#CDFF50" stroke="none"/>
            </svg>
          </div>

          <h1 className={styles.heading}>You're not on<br />the beta list yet.</h1>
          <p className={styles.sub}>
            Strangr is in private beta.<br />
            Request access and we'll let you know when it's your turn.
          </p>

          <div className={styles.separator} />

          {!submitted ? (
            <div className={styles.requestBox}>
              <div className={styles.requestHeader}>
                <div className={styles.requestIconWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <div>
                  <div className={styles.requestTitle}>Request access</div>
                  <div className={styles.requestDesc}>Enter your email and we'll notify you when you're in.</div>
                </div>
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <form onSubmit={handleRequest} className={styles.form}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'SENDING...' : 'REQUEST ACCESS'} {!loading && '→'}
                </button>
              </form>
            </div>
          ) : (
            <div className={styles.successBox}>
              <div className={styles.successIcon}>✓</div>
              <div className={styles.successTitle}>You're on the list.</div>
              <div className={styles.successDesc}>We'll reach out to <strong>{email}</strong> when your spot opens up.</div>
            </div>
          )}

          <div className={styles.privacyNote}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            We'll never share your email. See our{' '}
            <Link href="/privacy" className={styles.privacyLink}>Privacy Policy</Link>.
          </div>
        </div>
      </main>
    </div>
  )
}

export default function BlockedPage() {
  return <Suspense><BlockedContent /></Suspense>
}
