import { useMemo, useRef, useState } from 'react'
import BrandLogo from './BrandLogo'

export type HistorySummary = { id: string; date: string; note: string; mode: string; finalSale: string; balance: string; savedAt: string; matched?: boolean }
type Props = {
  items: HistorySummary[]; onSave: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void
  onExcel: () => void; onShare: () => void; onBackup: (password: string) => void; onRestore: (file: File, password: string) => void
  onNewClosing?: () => void
}

export default function DataHub(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const visible = useMemo(() => props.items.filter(item => {
    const dateMatch = !filter || item.date === filter
    const q = query.trim().toLowerCase()
    return dateMatch && (!q || `${item.date} ${item.note} ${item.mode} ${item.finalSale}`.toLowerCase().includes(q))
  }), [filter, props.items, query])
  const password = (message: string) => window.prompt(message)?.trim() || ''
  const matchedCount = props.items.filter(item => item.matched).length

  return <div className="page-stack history-page">
    <section className="page-hero history-hero">
      <div><span className="page-kicker">RECORDS · BACKUP · EXPORT</span><h1>Daily history</h1><p>हर saved closing, report और backup एक अलग सुरक्षित जगह।</p></div>
      <div className="history-hero-mark"><BrandLogo compact/><span><b>{props.items.length}</b><small>saved days</small></span></div>
    </section>

    <div className="history-overview">
      <article><span>▤</span><div><small>Total records</small><b>{props.items.length}</b></div></article>
      <article><span>✓</span><div><small>Matched</small><b>{matchedCount}</b></div></article>
      <article><span>!</span><div><small>Needs check</small><b>{props.items.length - matchedCount}</b></div></article>
    </div>

    <section className="card data-hub standalone">
      <div className="section-head"><div><p className="eyebrow">Quick actions</p><h2>Data center</h2></div><button type="button" className="data-save-top" onClick={props.onSave}>＋ Save current day</button></div>
      <div className="data-actions">
        <button type="button" className="data-primary" onClick={props.onSave}><b>＋ Save today</b><small>Current verified closing</small></button>
        <button type="button" onClick={props.onExcel}><b>▦ Excel</b><small>Actual .xlsx report</small></button>
        <button type="button" onClick={props.onShare}><b>↗ Share</b><small>WhatsApp / apps</small></button>
        <button type="button" onClick={() => { const value = password('Backup password बनाएँ (कम से कम 4 characters)'); if (value.length >= 4) props.onBackup(value) }}><b>⇩ Backup</b><small>AES encrypted</small></button>
        <button type="button" onClick={() => fileRef.current?.click()}><b>⇧ Restore</b><small>.pumpbook file</small></button>
        <input ref={fileRef} hidden type="file" accept=".pumpbook,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const value = password('इस backup का password डालें'); if (value) props.onRestore(file, value) }}/>
      </div>
    </section>

    <section className="card history-browser">
      <div className="history-browser-head"><div><p className="eyebrow">Saved closings</p><h2>Browse records</h2></div><span>{visible.length} shown</span></div>
      <div className="history-filters"><label><i>⌕</i><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search staff, machine, mode…"/></label><input type="date" value={filter} onChange={event => setFilter(event.target.value)}/>{(filter || query) && <button onClick={() => { setFilter(''); setQuery('') }}>Clear</button>}</div>
      {visible.length ? <div className="history-list">{visible.map(item => <article key={item.id}>
        <div className="history-date"><b>{item.date}</b><span>{item.savedAt}</span></div>
        <div className="history-main"><span className={`history-match ${item.matched ? 'ok' : 'check'}`}>{item.matched ? 'MATCH' : 'CHECK'}</span><b>{item.note || item.mode}</b><small>{item.mode} · Fault {item.balance}</small></div>
        <strong className="history-sale">{item.finalSale}</strong>
        <div className="history-buttons"><button onClick={() => props.onOpen(item.id)}>Open</button><button className="danger" onClick={() => props.onDelete(item.id)}>Delete</button></div>
      </article>)}</div> : <div className="history-empty"><BrandLogo compact animated={false}/><b>No matching record</b><span>Date या search बदलकर देखें।</span></div>}
    </section>
  </div>
}
