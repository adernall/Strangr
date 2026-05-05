'use client'
import { useState } from 'react'
import Link from 'next/link'
import styles from './TopBar.module.css'

export default function TopBar() {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <Link href="/feed" className={styles.logoDesktop}>
          <img src="/logo-icon.png" alt="Strangr" className={styles.logoImg} onError={e => { e.target.style.display = 'none' }} />
          <span className={styles.logoText}>strangr</span>
          <span className={styles.betaBadge}>BETA</span>
        </Link>
        <Link href="/feed" className={styles.logoMobile}>Strangr</Link>
      </div>

      <div className={styles.center}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search..." className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.right}>
        <button className={styles.createBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <button className={styles.mobileSearchBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>

        <button className={styles.bellBtn}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className={styles.bellDot} />
        </button>

        <div className={styles.avatarWrap}>
          <button className={styles.avatarBtn} onClick={() => setDropdownOpen(o => !o)}>
            <div className={styles.avatar} />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {dropdownOpen && (
            <>
              <div className={styles.dropdownOverlay} onClick={() => setDropdownOpen(false)} />
              <div className={styles.dropdown}>
                <Link href="/profile" className={styles.dropItem} onClick={() => setDropdownOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  My Profile
                </Link>
                <Link href="/dashboard" className={styles.dropItem} onClick={() => setDropdownOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  Dashboard
                </Link>
                <div className={styles.dropDivider} />
                <button className={styles.dropItem} onClick={() => setDropdownOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <span style={{color:'#ef4444'}}>Log out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}