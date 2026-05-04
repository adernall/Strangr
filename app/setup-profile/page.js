'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import NavLogo from '@/components/NavLogo'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import styles from './setup.module.css'

function StrangrIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="14" cy="14" r="10" stroke="white" strokeWidth="3" fill="none"/>
      <circle cx="26" cy="26" r="10" stroke="white" strokeWidth="3" fill="none"/>
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

export default function SetupProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({ username: '', dob: '', bio: '' })
  const [avatar, setAvatar] = useState(null)       // preview URL
  const [avatarFile, setAvatarFile] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return setError('Avatar must be under 5MB.')
    setAvatarFile(file)
    setAvatar(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.username.trim()) return setError('Please choose a username.')
    if (form.username.length < 3) return setError('Username must be at least 3 characters.')
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return setError('Username can only contain letters, numbers, and underscores.')

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) { router.push('/login'); return; }

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', form.username.trim().toLowerCase())
      .single()

    if (existing) {
      setLoading(false)
      return setError('That username is already taken. Try another.')
    }

    // Upload avatar if provided
    let avatarUrl = null
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true })

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = urlData.publicUrl
      }
    }

    // Create real profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: form.username.trim().toLowerCase(),
        display_name: form.username.trim(),
        bio: form.bio.trim() || null,
        date_of_birth: form.dob || null,
        avatar_url: avatarUrl,
        is_anonymous: false,
        role: 'user',
        created_at: new Date().toISOString(),
      })

    setLoading(false)
    if (profileErr) {
      setError(profileErr.message)
    } else {
      router.push('/feed')
    }
  }

  // Preview values
  const previewUsername = form.username || 'your_handle'
  const previewBio = form.bio || 'Your bio will appear here.'

  return (
    <div className={styles.page}>
      <div className={styles.glow1} />

      {/* ── TOP BAR ── */}
      <div className={styles.topbar}>
        <NavLogo />
        <Link href="/" className={styles.closeBtn}>CLOSE ×</Link>
      </div>

      <main className={styles.main}>
        {/* ── LEFT: PROFILE PREVIEW (desktop only) ── */}
        <div className={styles.previewSide}>
          <div className={styles.previewLabel}>PROFILE PREVIEW</div>
          <div className={styles.previewSub}>This is how others will see your profile.</div>

          <div className={styles.previewCard}>
            {/* Avatar */}
            <div className={styles.previewAvatarWrap}>
              {avatar
                ? <img src={avatar} alt="avatar" className={styles.previewAvatar} />
                : <div className={styles.previewAvatarPlaceholder}><UserIcon /></div>
              }
              <div className={styles.previewAvatarPlus}>+</div>
            </div>

            {/* Name + handle */}
            <div className={styles.previewName}>{previewUsername}</div>
            <div className={styles.previewHandle}>@{previewUsername}</div>
            <div className={styles.previewBio}>{previewBio}</div>

            {form.dob && (
              <div className={styles.previewMeta}>
                <span>📅 {new Date(form.dob).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                <span>·</span>
                <span>📍 Earth</span>
              </div>
            )}

            {/* Stats */}
            <div className={styles.previewStats}>
              <div className={styles.previewStat}>
                <span className={styles.previewStatNum}>0</span>
                <span className={styles.previewStatLabel}>Posts</span>
              </div>
              <div className={styles.previewStat}>
                <span className={styles.previewStatNum}>0</span>
                <span className={styles.previewStatLabel}>Followers</span>
              </div>
              <div className={styles.previewStat}>
                <span className={styles.previewStatNum}>0</span>
                <span className={styles.previewStatLabel}>Following</span>
              </div>
            </div>

            {/* Tabs */}
            <div className={styles.previewTabs}>
              <div className={`${styles.previewTab} ${styles.previewTabActive}`}>POSTS</div>
              <div className={styles.previewTab}>SPACES</div>
            </div>

            {/* Empty posts */}
            <div className={styles.previewPostsGrid}>
              <div className={styles.previewPost}>
                <div className={styles.previewPostTitle}>late night thoughts</div>
                <div className={styles.previewPostText}>people come and go{'\n'}like bus stops in the rain.</div>
                <div className={styles.previewPostMeta}><span>♡ 0</span><span>just now</span></div>
              </div>
              <div className={styles.previewPost}>
                <div className={styles.previewPostText}>what's a feeling you can't put into words?</div>
                <div className={styles.previewPostMeta}><span>♡ 0</span><span>just now</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: FORM ── */}
        <div className={styles.formSide}>
          <h1 className={styles.heading}>Setup your profile.</h1>
          <p className={styles.sub}>A few details to get you started.</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* USERNAME */}
            <div className={styles.field}>
              <label className={styles.label}>USERNAME</label>
              <div className={styles.inputWrap}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={set('username')}
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  autoComplete="off"
                />
              </div>
              <span className={styles.hint}>This will be your unique handle on Strangr.</span>
            </div>

            {/* AVATAR */}
            <div className={styles.field}>
              <label className={styles.label}>AVATAR</label>
              <div
                className={styles.avatarUpload}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatar
                  ? <img src={avatar} alt="avatar preview" className={styles.avatarPreview} />
                  : <div className={styles.avatarUploadIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                }
                <div className={styles.avatarUploadText}>
                  <span className={styles.avatarUploadTitle}>Upload your avatar</span>
                  <span className={styles.avatarUploadSub}>JPG, PNG or GIF. Max 5MB.</span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* DATE OF BIRTH */}
            <div className={styles.field}>
              <label className={styles.label}>DATE OF BIRTH</label>
              <div className={styles.inputWrap}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <input
                  type="date"
                  value={form.dob}
                  onChange={set('dob')}
                  className={`${styles.input} ${styles.inputWithIcon} ${styles.dateInput}`}
                />
              </div>
            </div>

            {/* BIO */}
            <div className={styles.field}>
              <label className={styles.label}>BIO</label>
              <div className={styles.textareaWrap}>
                <textarea
                  placeholder="Tell us a bit about yourself..."
                  value={form.bio}
                  onChange={set('bio')}
                  maxLength={160}
                  rows={4}
                  className={styles.textarea}
                />
                <span className={styles.charCount}>{form.bio.length} / 160</span>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'SETTING UP...' : 'FINISH SETUP'} {!loading && '→'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
