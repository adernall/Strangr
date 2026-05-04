import Link from 'next/link'

export default function FeedPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Syne, sans-serif',
      color: '#fff',
      gap: '1rem',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '8px' }}>✦</div>
      <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px' }}>
        You're in.
      </h1>
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', maxWidth: '300px', lineHeight: 1.7 }}>
        The feed is coming in Phase 6. For now, your account is set up and ready.
      </p>
      <Link href="/" style={{
        marginTop: '1rem',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: '#000',
        background: '#fff',
        padding: '12px 24px',
        borderRadius: '100px',
        textDecoration: 'none'
      }}>
        BACK TO HOME
      </Link>
    </div>
  )
}
