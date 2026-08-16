import { useRef, useState } from 'react'

export type HistorySummary = { id: string; date: string; note: string; mode: string; finalSale: string; balance: string; savedAt: string }
type Props = {
  items: HistorySummary[]; onSave: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void
  onExcel: () => void; onShare: () => void; onBackup: (password: string) => void; onRestore: (file: File, password: string) => void
}

export default function DataHub(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState('')
  const [show, setShow] = useState(false)
  const visible = filter ? props.items.filter(item => item.date === filter) : props.items
  const password = (message: string) => window.prompt(message)?.trim() || ''
  return <section className="card data-hub">
    <div className="section-head"><div className="section-title"><span className="section-icon data-icon">▤</span><div><p className="eyebrow">Records · Backup · Export</p><h2>Daily Data Center</h2><p className="section-sub">History और reports इस device पर सुरक्षित</p></div></div><button type="button" className="soft-badge data-toggle" onClick={() => setShow(value => !value)}>{show ? 'Hide' : `${props.items.length} saved days`}</button></div>
    <div className="data-actions">
      <button type="button" className="data-primary" onClick={props.onSave}><b>＋ Save today</b><small>Current closing</small></button>
      <button type="button" onClick={props.onExcel}><b>▦ Excel</b><small>Actual .xlsx</small></button>
      <button type="button" onClick={props.onShare}><b>↗ Share</b><small>WhatsApp / apps</small></button>
      <button type="button" onClick={() => { const value = password('Backup password बनाएँ (कम से कम 4 characters)'); if (value.length >= 4) props.onBackup(value) }}><b>⇩ Backup</b><small>AES encrypted</small></button>
      <button type="button" onClick={() => fileRef.current?.click()}><b>⇧ Restore</b><small>.pumpbook file</small></button>
      <input ref={fileRef} hidden type="file" accept=".pumpbook,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; const value = password('इस backup का password डालें'); if (value) props.onRestore(file, value) }}/>
    </div>
    {show && <div className="history-panel">
      <div className="history-toolbar"><b>Saved closings</b><input type="date" value={filter} onChange={event => setFilter(event.target.value)}/>{filter && <button onClick={() => setFilter('')}>Clear</button>}</div>
      {visible.length ? <div className="history-list">{visible.map(item => <article key={item.id}><div className="history-date"><b>{item.date}</b><span>{item.savedAt}</span></div><div><b>{item.finalSale}</b><span>{item.note || item.mode} · Fault {item.balance}</span></div><div className="history-buttons"><button onClick={() => props.onOpen(item.id)}>Open</button><button className="danger" onClick={() => props.onDelete(item.id)}>Delete</button></div></article>)}</div> : <div className="history-empty">इस date का saved record नहीं मिला।</div>}
    </div>}
  </section>
}
