'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import NavLogo from '@/components/NavLogo'
import styles from './verify.module.css'

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
    setLoading(false)
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />

      <div className={styles.topbar}>
        <NavLogo />
        <Link href="/" className={styles.closeBtn}>CLOSE ×</Link>
      </div>

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#CDFF50" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>

          <h1 className={styles.heading}>Check your inbox.</h1>
          <p className={styles.sub}>
            We sent a verification link to<br />
            <strong className={styles.emailHighlight}>{email}</strong>
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span>Open the email from Strangr</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span>Click the confirmation link</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span>You'll be taken to set up your profile</span>
            </div>
          </div>

          <div className={styles.divider} />

          <p className={styles.resendText}>Didn't get it? Check spam, or</p>
          <button
            onClick={handleResend}
            disabled={loading || resent}
            className={styles.resendBtn}
          >
            {resent ? '✓ Sent again' : loading ? 'Sending...' : 'Resend verification email'}
          </button>

          <p className={styles.wrongEmail}>
            Wrong email?{' '}
            <Link href="/signup" className={styles.link}>Start over</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}
