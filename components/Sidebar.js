'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'

const NAV = [
  { href: '/feed', label: 'Home', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { href: '/discover', label: 'Discover', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg> },
  { href: '/inbox', label: 'Inbox', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  { href: '/orbit', label: 'Orbit', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {NAV.map(item => (
          <Link key={item.href} href={item.href} className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}>
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.activeStrip}>
        <div className={styles.activeAvatars}>
          {['#CDFF50','#3B82F6','#22C55E'].map((c,i) => (
            <div key={i} className={styles.activeAvatar} style={{background:c}} />
          ))}
          <div className={styles.activeMore}>+1</div>
        </div>
        <div className={styles.activeDesc}>Let's chat about new Avengers Movie</div>
        <div className={styles.activeHandle}>#AvengerPhile</div>
        <div className={styles.activeBtns}>
          <button className={styles.joinBtn}>Join</button>
          <button className={styles.notBtn}>Not now</button>
        </div>
      </div>
    </aside>
  )
}