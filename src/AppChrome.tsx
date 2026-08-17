import { useEffect } from 'react'
import type { ReactNode } from 'react'
import BrandLogo from './BrandLogo'

export type AppPage = 'home' | 'closing' | 'history' | 'settings'

type Props = {
  page: AppPage
  drawerOpen: boolean
  onDrawer: (open: boolean) => void
  onNavigate: (page: AppPage) => void
  onPrint: () => void
  version: string
  children: ReactNode
}

const nav: { page: AppPage; icon: string; label: string }[] = [
  { page: 'home', icon: '⌂', label: 'Home' },
  { page: 'closing', icon: '⌗', label: 'Closing' },
  { page: 'history', icon: '▤', label: 'History' },
  { page: 'settings', icon: '⚙', label: 'Settings' }
]

export default function AppChrome({ page, drawerOpen, onDrawer, onNavigate, onPrint, version, children }: Props) {
  useEffect(() => {
    if (!drawerOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onDrawer(false) }
    document.addEventListener('keydown', close)
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = before }
  }, [drawerOpen, onDrawer])

  const go = (next: AppPage) => { onNavigate(next); onDrawer(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <div className="app-frame">
    <header className="app-topbar">
      <button className="menu-button" onClick={() => onDrawer(true)} aria-label="Open app menu"><i/><i/><i/></button>
      <button className="topbar-brand" onClick={() => go('home')} aria-label="Pump Book home">
        <BrandLogo compact animated={false}/><span><b>Pump Book</b><small>SMART DAILY CLOSING</small></span>
      </button>
      <span className="topbar-by">by <b>Ansh</b></span>
    </header>

    {drawerOpen && <div className="drawer-backdrop" onClick={() => onDrawer(false)}>
      <aside className="app-drawer" role="dialog" aria-modal="true" aria-label="App menu" onClick={event => event.stopPropagation()}>
        <div className="drawer-brand"><BrandLogo/><div><span>SMART PETROL LEDGER</span><strong>Pump <em>Book</em></strong><small>Fuel counted. Every rupee matched.</small></div></div>
        <nav className="drawer-nav">{nav.map(item => <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => go(item.page)}><i>{item.icon}</i><span>{item.label}</span><b>›</b></button>)}</nav>
        <div className="drawer-tools">
          <button onClick={onPrint}><span>▧</span><div><b>Print current report</b><small>A4 day-closing sheet</small></div></button>
          <button onClick={() => go('history')}><span>⇩</span><div><b>Backup &amp; export</b><small>Encrypted and offline</small></div></button>
        </div>
        <div className="drawer-foot"><span><i/> Private on device</span><b>v{version}</b></div>
      </aside>
    </div>}

    <div className="app-content">{children}</div>

    <nav className="bottom-nav" aria-label="Main navigation">{nav.map(item => <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => go(item.page)}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>
  </div>
}
