import BrandLogo from './BrandLogo'
import type { AppPage } from './AppChrome'

type Props = {
  date: string
  note: string
  mode: string
  verified: number
  complete: boolean
  valid: boolean
  finalSale: string
  balance: string
  matched: boolean
  historyCount: number
  recent: { id: string; date: string; note: string; finalSale: string; balance: string }[]
  onNavigate: (page: AppPage) => void
  onOpenRecord: (id: string) => void
}

export default function HomePage(props: Props) {
  const progress = Math.round(props.verified / 8 * 100)
  return <div className="page-stack home-page">
    <section className="home-hero">
      <div className="liquid-orb liquid-a"/><div className="liquid-orb liquid-b"/><div className="paint-stroke"/>
      <div className="home-brand"><BrandLogo/><div><span>SMART PETROL PUMP LEDGER</span><h1>Pump <em>Book</em></h1><p>हर लीटर दर्ज। हर रुपया Match.</p><b>by Ansh</b></div></div>
      <div className="home-motto"><i>“</i><strong>Fuel counted.<br/>Every rupee matched.</strong><span>Fast · Private · Offline</span></div>
      <div className="fuel-drops"><i/><i/><i/><i/></div>
    </section>

    <section className="today-board">
      <div className="today-head"><div><span>TODAY'S CLOSING</span><h2>{props.date}</h2><p>{props.note || props.mode}</p></div><span className={`closing-state ${props.complete && props.valid ? 'ready' : ''}`}><i/>{props.complete && props.valid ? 'Verified' : 'In progress'}</span></div>
      <div className="today-progress"><span style={{ width: `${progress}%` }}/></div>
      <div className="today-stats">
        <div><small>Readings</small><b>{props.verified}<i>/8</i></b></div>
        <div><small>Final sale</small><b>{props.complete && props.valid ? props.finalSale : 'Verify first'}</b></div>
        <div><small>Cash status</small><b className={props.matched && props.complete ? 'good' : 'warn'}>{props.complete ? (props.matched ? 'MATCH' : props.balance) : 'Pending'}</b></div>
      </div>
      <button className="start-closing" onClick={() => props.onNavigate('closing')}><span className="button-drop">⌗</span><span><b>{props.verified ? 'Continue daily closing' : 'Start smart closing'}</b><small>Scan Morning + Evening slips</small></span><i>→</i></button>
    </section>

    <div className="home-quick-grid">
      <button onClick={() => props.onNavigate('closing')}><span className="quick-icon scan">⌗</span><div><b>Smart Scan</b><small>ML Kit receipt OCR</small></div><i>›</i></button>
      <button onClick={() => props.onNavigate('history')}><span className="quick-icon history">▤</span><div><b>History</b><small>{props.historyCount} saved closings</small></div><i>›</i></button>
      <button onClick={() => props.onNavigate('settings')}><span className="quick-icon palette">◐</span><div><b>Appearance</b><small>Themes &amp; wallpapers</small></div><i>›</i></button>
    </div>

    <section className="card recent-card">
      <div className="section-head"><div><p className="eyebrow">LOCAL HISTORY</p><h2>Recent closings</h2></div><button className="text-button" onClick={() => props.onNavigate('history')}>View all →</button></div>
      {props.recent.length ? <div className="recent-list">{props.recent.map(item => <button key={item.id} onClick={() => props.onOpenRecord(item.id)}><span className="recent-date"><b>{item.date.slice(-2)}</b><small>{item.date.slice(0, 7)}</small></span><span><b>{item.note || 'Daily closing'}</b><small>Fault {item.balance}</small></span><strong>{item.finalSale}</strong><i>›</i></button>)}</div> : <div className="premium-empty"><BrandLogo compact animated={false}/><div><b>No closing saved yet</b><span>पहला record पूरा करके History में save करें।</span></div></div>}
    </section>

    <section className="privacy-strip"><span>◇</span><div><b>Private by design</b><small>OCR और हिसाब device पर रहता है। कोई cloud OCR bill नहीं।</small></div><i>OFFLINE</i></section>
  </div>
}
