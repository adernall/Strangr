'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import NavLogo from '@/components/NavLogo'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { validateEmail } from '@/lib/validateEmail'
import styles from './login.module.css'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(
    searchParams.get('error') === 'verification_failed'
      ? 'Verification link expired or invalid. Please sign up again.'
      : ''
  )
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const emailError = validateEmail(form.email)
    if (emailError) return setError(emailError)

    setLoading(true)
    const supabase = createClient()
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    })

    setLoading(false)

    if (loginError) {
      if (loginError.message.toLowerCase().includes('email not confirmed')) {
        router.push('/signup/verify?email=' + encodeURIComponent(form.email.trim()))
        return
      }
      setError('Wrong email or password. Please try again.')
      return
    }

    // Check if profile is set up
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', data.user.id)
      .single()

    if (profile?.username) {
      router.push('/feed')
    } else {
      router.push('/setup-profile')
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

          <h1 className={styles.heading}>Welcome back.</h1>
          <p className={styles.sub}>Sign in to your quiet place.</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
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

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label}>PASSWORD</label>
                <Link href="/reset-password" className={styles.forgotLink}>Forgot password?</Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                className={styles.input}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'SIGNING IN...' : 'LOG IN'} {!loading && '→'}
            </button>
          </form>

          <p className={styles.signupHint}>
            Don't have an account?{' '}
            <Link href="/signup" className={styles.signupLink}>Join Strangr</Link>
          </p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
