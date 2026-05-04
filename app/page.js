'use client'
import Link from 'next/link'
import NavLogo from '@/components/NavLogo'
import styles from './landing.module.css'

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      {/* ── TOP NAV ── */}
      <nav className={styles.nav}>
        <NavLogo />
        <div className={styles.navLinks}>
          <Link href="/manifesto">Manifesto</Link>
          <Link href="/spaces">Spaces</Link>
          <Link href="/feed">Feed</Link>
        </div>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navLogin}>LOG IN</Link>
          <Link href="/signup" className={styles.navJoin}>JOIN STRANGR</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <main className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.betaPill}>
            <span className={styles.betaDot} />
            IN PRIVATE BETA · 2,531 INVITED
          </div>

          <h1 className={styles.headline}>
            A quiet place<br />
            for <em>loud</em> ideas.
          </h1>

          <p className={styles.subtext}>
            Strangr is the anti-noise network for makers.<br />
            No engagement traps. No outrage feed.<br />
            Just curated spaces and posts that earned the room.
          </p>

          <div className={styles.ctaRow}>
            <Link href="/signup" className={styles.ctaPrimary}>
              CLAIM YOUR HANDLE <span className={styles.arrow}>→</span>
            </Link>
            <Link href="/feed" className={styles.ctaSecondary}>
              PREVIEW THE FEED <span className={styles.arrow}>→</span>
            </Link>
          </div>
        </div>

        {/* ── GIF RIGHT SIDE ──
            Place your GIF at: /public/hero.gif
            Square format recommended (e.g. 600×600px or 800×800px)
        */}
        <div className={styles.heroRight}>
          <div className={styles.gifWrap}>
            <img
              src="/hero.gif"
              alt=""
              className={styles.heroGif}
              draggable={false}
            />
            {/* Fade overlays — smooth blend into black */}
            <div className={styles.gifFadeLeft} />
            <div className={styles.gifFadeTop} />
            <div className={styles.gifFadeBottom} />
          </div>
        </div>
      </main>
    </div>
  )
}
