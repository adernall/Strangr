'use client'
import Link from 'next/link'
import styles from './NavLogo.module.css'

export default function NavLogo() {
  return (
    <Link href="/" className={styles.logo}>
      {/* 
        YOUR LOGO IMAGE
        ────────────────────────────────────────
        Place your logo file at: /public/logo-icon.png
        Recommended size: 28×28px or 32×32px PNG
        If file is missing, the text logo still shows fine.
      */}
      <img
        src="/logo-icon.png"
        alt="Strangr"
        className={styles.logoImg}
        onError={e => { e.target.style.display = 'none' }}
      />
      <span className={styles.logoText}>strangr</span>
      <span className={styles.betaBadge}>BETA</span>
    </Link>
  )
}
