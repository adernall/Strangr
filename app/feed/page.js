import AppShell from '@/components/AppShell'
import styles from './feed.module.css'

const NOW_CARDS = [
  { title: 'Donald Trump', desc: 'Donald Trump delivers a combative, off-script speech mixing war claims with sharp attacks on critics.', tags: ['GEOPOLITICAL', 'WAR'], color: '#1a2035' },
  { title: 'Bengal crisis', desc: 'West Bengal erupts in political turmoil after a shock power shift triggers violence...', tags: ['GEOPOLITICAL'], color: '#1a2820' },
  { title: 'Avengers Doomsday', desc: 'Avengers: Doomsday leaks hint at multiverse chaos with Tobey Maguire Spider-Man return...', tags: ['CINEMA', 'MARVEL'], color: '#1f1a28' },
]

const POSTS = [
  { id: 1, username: 'Marcus.eth', time: '2 hours ago', content: 'Just finished watching the leaked concept art for the upcoming Spider-Man movie. If even half of these rumors are true, this is going to be the biggest cinematic event since Endgame. The multiversal implications are insane!', likes: '1.2k', comments: 84, verified: false, hasImage: false },
  { id: 2, username: 'NewsWire_Global', time: '45 minutes ago', content: 'BREAKING: Recent data suggests a significant shift in regional stability. Local authorities are urging calm while diplomatic channels remain open. Follow for real-time updates. #WorldNews #Geopolitics', likes: '5.4k', comments: 312, verified: true, hasImage: true },
]

const PEOPLE = [
  { name: 'Sarah Jenkins', handle: '@sjenks_art' },
  { name: 'Alex Rivera', handle: '@arivera_dev' },
  { name: 'Elena Vance', handle: '@vance_vance' },
]

const SPACES = [
  { name: 'Tech Pulse', members: '2.4k members', color: '#f59e0b' },
  { name: 'Design Den', members: '8.1k members', color: '#8b5cf6' },
  { name: 'Climate Watch', members: '12k members', color: '#06b6d4' },
]

export default function FeedPage() {
  return (
    <AppShell>
      <div className={styles.feedLayout}>
        <div className={styles.center}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${styles.tabActive}`}>Now</button>
            <button className={styles.tab}>Following</button>
            <button className={styles.tab}>New</button>
          </div>
          <div className={styles.nowScroll}>
            {NOW_CARDS.map((card, i) => (
              <div key={i} className={styles.nowCard} style={{background: card.color}}>
                <div className={styles.nowCardImg} />
                <div className={styles.nowCardOverlay}>
                  <div className={styles.nowCardTitle}>{card.title}</div>
                  <div className={styles.nowCardDesc}>{card.desc}</div>
                  <div className={styles.nowCardTags}>
                    {card.tags.map(t => <span key={t} className={styles.nowCardTag}>{t}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.postsLabel}>Posts</div>
          <div className={styles.posts}>
            {POSTS.map(post => (
              <div key={post.id} className={styles.postCard}>
                <div className={styles.postHeader}>
                  <div className={styles.postAvatar} />
                  <div className={styles.postMeta}>
                    <div className={styles.postUser}>
                      <span className={styles.postUsername}>{post.username}</span>
                      {post.verified && <span className={styles.verified}>VERIFIED</span>}
                    </div>
                    <div className={styles.postTime}>{post.time}</div>
                  </div>
                  <button className={styles.postMore}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
                  </button>
                </div>
                <div className={styles.postContent}>{post.content}</div>
                {post.hasImage && <div className={styles.postImage} />}
                <div className={styles.postActions}>
                  <button className={styles.action}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    {post.likes}
                  </button>
                  <button className={styles.action}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    {post.comments}
                  </button>
                  <button className={styles.action}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className={styles.rightSidebar}>
          <div className={styles.widget}>
            <div className={styles.widgetTitle}>People to follow</div>
            {PEOPLE.map(p => (
              <div key={p.handle} className={styles.personRow}>
                <div className={styles.personAvatar} />
                <div className={styles.personInfo}>
                  <div className={styles.personName}>{p.name}</div>
                  <div className={styles.personHandle}>{p.handle}</div>
                </div>
                <button className={styles.followBtn}>Follow</button>
              </div>
            ))}
            <button className={styles.showMore}>Show more</button>
          </div>
          <div className={styles.widget}>
            <div className={styles.widgetTitle}>Spaces to join</div>
            {SPACES.map(s => (
              <div key={s.name} className={styles.spaceRow}>
                <div className={styles.spaceIcon} style={{background: s.color}} />
                <div className={styles.spaceInfo}>
                  <div className={styles.spaceName}>{s.name}</div>
                  <div className={styles.spaceMembers}>{s.members}</div>
                </div>
                <button className={styles.joinSpaceBtn}>Join</button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}