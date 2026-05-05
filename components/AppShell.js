import TopBar from './TopBar'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import styles from './AppShell.module.css'

export default function AppShell({ children }) {
  return (
    <div className={styles.shell}>
      <TopBar />
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
      <BottomNav />
    </div>
  )
}