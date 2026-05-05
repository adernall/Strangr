'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './BottomNav.module.css'

export default function BottomNav() {
  const pathname = usePathname()
  const active = (href) => pathname === href

  return (
    <nav className={styles.bottomNav}>
      <Link href="/feed" className={`${styles.tab} ${active('/feed') ? styles.active : ''}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={active('/feed') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </Link>
      <Link href="/discover" className={`${styles.tab} ${active('/discover') ? styles.active : ''}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
        </svg>
      </Link>
      <button className={styles.createBtn}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <Link href="/inbox" className={`${styles.tab} ${active('/inbox') ? styles.active : ''}`}>
        <div className={styles.multiAvatarWrap}>
          <div className={styles.miniAvatar} />
          <div className={styles.miniAvatar} style={{marginLeft:'-6px',background:'rgba(255,255,255,0.2)'}} />
          <div className={styles.onlineDot} />
        </div>
      </Link>
      <Link href="/profile" className={`${styles.tab} ${active('/profile') ? styles.active : ''}`}>
        <div className={styles.profileAvatar} />
      </Link>
    </nav>
  )
}