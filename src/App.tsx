import { useEffect, useMemo, useRef, useState } from 'react'
import ReceiptScanner from './ReceiptScanner'
import type { ReadingSlot } from './receiptOcr'

type Fuel = 'HSD' | 'MS'
type Mode = 'allHsd' | 'mixed'
type Reading = { evening: string; morning: string; photo: string }
type Payments = { udhari: string; paytm: string; fcard: string; phonepe: string; bank: string; kharche: string; cash: string; other: string }
type Draft = {
  mode: Mode; date: string; note: string; readings: Record<Mode, Reading[]>
  hsdTesting: string; hsdRate: string; msTesting: string; msRate: string; extra: string; payments: Payments
}
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const productMap: Record<Mode, Fuel[]> = {
  allHsd: ['HSD', 'HSD', 'HSD', 'HSD'],
  mixed: ['MS', 'HSD', 'MS', 'HSD']
}
const sampleReadings: Record<Mode, Reading[]> = {
  allHsd: Array.from({ length: 4 }, () => ({ evening: '', morning: '', photo: '' })),
  mixed: Array.from({ length: 4 }, () => ({ evening: '', morning: '', photo: '' }))
}
const emptyPayments: Payments = { udhari: '', paytm: '', fcard: '', phonepe: '', bank: '', kharche: '', cash: '', other: '' }
const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const initialDraft = (): Draft => ({
  mode: 'allHsd', date: localDate(), note: '',
  readings: structuredClone(sampleReadings),
  hsdTesting: '', hsdRate: '', msTesting: '', msRate: '', extra: '',
  payments: { ...emptyPayments }
})
// Old drafts stored '0' everywhere — convert to '' so inputs start clean (no zero-hatao)
const clean = (v: unknown): string => (v === null || v === undefined || v === 0 || v === '0' || v === '') ? '' : String(v)
const sanitize = (raw: unknown): Draft => {
  const d = initialDraft()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Partial<Draft>
  if (r.mode === 'allHsd' || r.mode === 'mixed') d.mode = r.mode
  if (typeof r.date === 'string' && r.date) d.date = r.date
  if (typeof r.note === 'string') d.note = r.note
  for (const m of ['allHsd', 'mixed'] as Mode[]) {
    const arr = r.readings?.[m]
    d.readings[m] = Array.from({ length: 4 }, (_, i) => ({
      evening: clean(arr?.[i]?.evening),
      morning: clean(arr?.[i]?.morning),
      photo: typeof arr?.[i]?.photo === 'string' && arr[i].photo.startsWith('data:image/') ? arr[i].photo : ''
    }))
  }
  d.hsdTesting = clean(r.hsdTesting); d.hsdRate = clean(r.hsdRate)
  d.msTesting = clean(r.msTesting); d.msRate = clean(r.msRate)
  d.extra = clean(r.extra)
  d.payments = Object.fromEntries((Object.keys(emptyPayments) as (keyof Payments)[]).map(k => [k, clean(r.payments?.[k])])) as Payments
  return d
}
const num = (v: string) => Number.isFinite(Number.parseFloat(v)) ? Number.parseFloat(v) : 0
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = (v: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

function Field({ label, value, onChange, step = '0.01', placeholder, type = 'number' }: { label: string; value: string; onChange: (v: string) => void; step?: string; placeholder?: string; type?: 'number' | 'date' | 'text' }) {
  return <label className="field-label">
    <span>{label}</span>
    <input
      inputMode={type === 'number' ? 'decimal' : undefined}
      type={type}
      step={type === 'number' ? step : undefined}
      value={value}
      placeholder={placeholder}
      onFocus={type === 'number' ? e => e.currentTarget.select() : undefined}
      onChange={e => onChange(e.target.value)}
    />
  </label>
}

export default function App() {
  const STORAGE_KEY = 'pump-book-draft-v3'
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('pump-book-draft-v2')
      if (!saved) return initialDraft()
      localStorage.removeItem('pump-book-draft-v2')
      return sanitize(JSON.parse(saved))
    } catch { return initialDraft() }
  })
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)
  const map = productMap[draft.mode]
  const fuels = useMemo(() => Array.from(new Set(map)), [map])
  const diffs = useMemo(() => draft.readings[draft.mode].map(r => num(r.evening) - num(r.morning)), [draft.readings, draft.mode])
  const gross = useMemo(() => map.reduce((a, f, i) => { a[f] += diffs[i]; return a }, { HSD: 0, MS: 0 } as Record<Fuel, number>), [map, diffs])
  const hsdNet = gross.HSD - num(draft.hsdTesting), msNet = gross.MS - num(draft.msTesting)
  const hsdAmount = hsdNet * num(draft.hsdRate), msAmount = msNet * num(draft.msRate)
  const extraNum = num(draft.extra)
  const finalSale = hsdAmount + msAmount + extraNum
  const accounted = Object.values(draft.payments).reduce((sum, v) => sum + num(v), 0)
  const balance = finalSale - accounted
  const hasNegative = diffs.some(d => d < 0)
  const matched = Math.abs(balance) <= 0.05

  // Auto-save (debounced) — data har change ke baad device par save hota hai
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
        setSaveError(null)
      } catch {
        setSaveError('⚠ Storage full ho gaya — kuch photos delete karke data chhota karo')
      }
      setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    }, 600)
    return () => clearTimeout(t)
  }, [draft])

  // PWA install prompt
  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])
  const doInstall = async () => {
    if (!installEvt) return
    await installEvt.prompt()
    const choice = await installEvt.userChoice
    if (choice.outcome === 'accepted') setInstallEvt(null)
  }

  const updateReading = (index: number, key: keyof Reading, value: string) => setDraft(d => {
    const readings = { ...d.readings, [d.mode]: d.readings[d.mode].map((r, i) => i === index ? { ...r, [key]: value } : r) }
    return { ...d, readings }
  })
  const updatePayment = (key: keyof Payments, value: string) => setDraft(d => ({ ...d, payments: { ...d.payments, [key]: value } }))
  const applyScannedReadings = (values: string[], slot: ReadingSlot) => setDraft(d => ({
    ...d,
    readings: {
      ...d.readings,
      [d.mode]: d.readings[d.mode].map((reading, index) => ({
        ...reading,
        // सुबह की slip Opening में और शाम की slip Closing में—दो scan से कुल 8 readings।
        [slot]: values[index] || reading[slot]
      }))
    }
  }))
  const clearEntries = () => setDraft(d => ({
    ...d,
    readings: { ...d.readings, [d.mode]: structuredClone(sampleReadings[d.mode]) },
    hsdTesting: '', msTesting: '', extra: '', payments: { ...emptyPayments }
  }))

  const fuelGross = (f: Fuel) => f === 'HSD' ? gross.HSD : gross.MS
  const fuelTest = (f: Fuel) => f === 'HSD' ? num(draft.hsdTesting) : num(draft.msTesting)
  const fuelNet = (f: Fuel) => f === 'HSD' ? hsdNet : msNet
  const fuelRate = (f: Fuel) => f === 'HSD' ? num(draft.hsdRate) : num(draft.msRate)
  const fuelAmount = (f: Fuel) => f === 'HSD' ? hsdAmount : msAmount

  const amountParts = fuels.map(f => inr.format(fuelAmount(f)))
  const extraStr = extraNum > 0 ? ` + ${inr.format(extraNum)}` : extraNum < 0 ? ` − ${inr.format(Math.abs(extraNum))}` : ''

  return <>
    <div className="shell">
      <div className="print-head">Pump Book — Day Report<span>{draft.date}{draft.note ? ` · ${draft.note}` : ''}</span></div>

      <header className="hero">
        <div className="brand"><div className="brand-mark">PB</div><div><strong>Pump Book</strong><span>One-day totalizer &amp; payment reconciliation</span></div></div>
        <div className="hero-row">
          <Field label="Date" value={draft.date} type="date" onChange={date => setDraft(d => ({ ...d, date }))} />
          <label className="field-label"><span>Machine / Staff note</span><input value={draft.note} placeholder="e.g. M1 / Ramesh" onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} /></label>
        </div>
      </header>

      <nav className="mode-tabs" aria-label="Calculation mode">
        <button className={draft.mode === 'allHsd' ? 'active' : ''} onClick={() => setDraft(d => ({ ...d, mode: 'allHsd' }))}><b>Mode 1</b><span>HSD · HSD · HSD · HSD</span></button>
        <button className={draft.mode === 'mixed' ? 'active' : ''} onClick={() => setDraft(d => ({ ...d, mode: 'mixed' }))}><b>Mode 2</b><span>MS · HSD · MS · HSD</span></button>
      </nav>

      <main>
        <section className="card">
          <div className="section-head"><div><p className="eyebrow">Step 1</p><h2>Totalizer readings</h2></div><div className="section-tools"><span className="help">सुबह + शाम की slips scan करें · कुल 8 readings</span><ReceiptScanner onApply={applyScannedReadings} /></div></div>
          <div className="totalizer-grid">{map.map((fuel, i) => <article className="totalizer" key={`${draft.mode}-${i}`}>
            <div className="totalizer-head"><b>T{i + 1}</b><span className={`fuel ${fuel.toLowerCase()}`}>{fuel}</span></div>
            <Field label="Evening / Closing" value={draft.readings[draft.mode][i].evening} step="0.001" placeholder="0.000" onChange={v => updateReading(i, 'evening', v)} />
            <Field label="Morning / Opening" value={draft.readings[draft.mode][i].morning} step="0.001" placeholder="0.000" onChange={v => updateReading(i, 'morning', v)} />
            <div className={`difference ${diffs[i] < 0 ? 'bad' : ''}`}><span>Difference</span><strong>{qty(diffs[i])}</strong></div>
          </article>)}</div>
          {hasNegative && <div className="alert">Negative difference मिला है—Evening और Morning reading check करें।</div>}
        </section>

        <section className="card">
          <div className="section-head"><div><p className="eyebrow">Step 2</p><h2>Testing &amp; editable rates</h2></div><span className="help">Yellow fields editable</span></div>
          <div className="settings-grid">
            <div className="setting hsd"><h3>HSD settings</h3><div className="two"><Field label="Testing qty" value={draft.hsdTesting} step="0.001" placeholder="0.000" onChange={hsdTesting => setDraft(d => ({ ...d, hsdTesting }))} /><Field label="Rate (₹/L)" value={draft.hsdRate} placeholder="e.g. 92.50" onChange={hsdRate => setDraft(d => ({ ...d, hsdRate }))} /></div></div>
            {draft.mode === 'mixed' && <div className="setting ms"><h3>MS settings</h3><div className="two"><Field label="Testing qty" value={draft.msTesting} step="0.001" placeholder="0.000" onChange={msTesting => setDraft(d => ({ ...d, msTesting }))} /><Field label="Rate (₹/L)" value={draft.msRate} placeholder="e.g. 105.00" onChange={msRate => setDraft(d => ({ ...d, msRate }))} /></div></div>}
            <div className="setting extra"><h3>Extra adjustment</h3><Field label="Plus (+) / Minus (−)" value={draft.extra} placeholder="+ / −" onChange={extra => setDraft(d => ({ ...d, extra }))} /></div>
          </div>
        </section>

        <section className="card">
          <div className="section-head"><div><p className="eyebrow">Step 3</p><h2>Fuel sale summary</h2></div><span className="help">Live calculation</span></div>
          <div className="summary-grid">
            <ProductSummary fuel="HSD" gross={gross.HSD} testing={num(draft.hsdTesting)} net={hsdNet} rate={num(draft.hsdRate)} amount={hsdAmount} />
            {draft.mode === 'mixed' && <ProductSummary fuel="MS" gross={gross.MS} testing={num(draft.msTesting)} net={msNet} rate={num(draft.msRate)} amount={msAmount} />}
          </div>
          <div className="sale-total"><div><span>FINAL FUEL SALE</span><strong>{inr.format(finalSale)}</strong></div><span className="pill">Calculated</span></div>

          <div className="calc-block">
            <h3>Full calculation — पूरा हिसाब</h3>
            <div className="calc-wrap">
              <table className="calc-table">
                <thead><tr><th>Fuel</th><th>Total qty (कुल)</th><th>Testing</th><th>Net qty</th><th>Rate (रेट)</th><th>Amount (रकम)</th></tr></thead>
                <tbody>{fuels.map(f => <tr key={f}>
                  <td><span className={`fuel ${f.toLowerCase()}`}>{f}</span></td>
                  <td>{qty(fuelGross(f))}</td>
                  <td>{qty(fuelTest(f))}</td>
                  <td>{qty(fuelNet(f))}</td>
                  <td>{inr.format(fuelRate(f))}</td>
                  <td>{inr.format(fuelAmount(f))}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="formula-lines">
              {fuels.map(f => <div key={f}>{f}: {qty(fuelNet(f))} L × {inr.format(fuelRate(f))} = <b>{inr.format(fuelAmount(f))}</b></div>)}
              {extraStr && <div>Extra (एक्स्ट्रा): {extraStr}</div>}
              <div className="final-line">FINAL = {amountParts.join(' + ')}{extraStr} = <b>{inr.format(finalSale)}</b></div>
            </div>
            <div className="nozzle-chips">{map.map((f, i) => <span key={i} className={f.toLowerCase()}>T{i + 1} · {f} = {qty(diffs[i])}</span>)}</div>
          </div>
        </section>

        <section className="card">
          <div className="section-head"><div><p className="eyebrow">Step 4</p><h2>Payment, udhari &amp; cash</h2></div><span className="help">Sale reconciliation</span></div>
          <div className="payment-grid">
            {(Object.entries({ udhari: 'Total Udhari', paytm: 'Total Paytm', fcard: 'Total F-Card', phonepe: 'Total PhonePe', bank: 'Bank / Other', kharche: 'Total Kharche', cash: 'Total Cash', other: 'Other adjustment' }) as [keyof Payments, string][]).map(([key, label]) => <Field key={key} label={label} value={draft.payments[key]} placeholder="0" onChange={v => updatePayment(key, v)} />)}
          </div>
          <div className="recon-grid"><Metric label="Final fuel sale" value={inr.format(finalSale)} /><Metric label="Total accounted" value={inr.format(accounted)} /><Metric label="Balance / fault" value={inr.format(balance)} danger={!matched} /></div>
          <div role="status" className={`match ${matched ? '' : 'check'}`}>{matched ? 'MATCH — हिसाब बराबर है' : `CHECK — ${inr.format(balance)} का difference`}</div>
        </section>

        {saveError && <div className="alert">{saveError}</div>}

        <div className="actions">
          <div className="actions-left">
            {!standalone && installEvt && <button className="install-btn" onClick={doInstall}>📲 Install app</button>}
            <span className="save-status">{savedAt ? `Auto-saved ✓ ${savedAt}` : 'Auto-save on'}</span>
          </div>
          <div className="actions-right">
            <button className="secondary" onClick={clearEntries}>Clear entries</button>
            <button className="primary" onClick={() => window.print()}>🖨 Print report</button>
          </div>
        </div>
        {!standalone && !installEvt && <p className="install-note">PWA ready: browser menu से “Add to Home Screen” चुनकर app install करें।</p>}
      </main>
      <footer>Pump Book · Data आपके device पर local रहता है · Auto-save on</footer>
    </div>

  </>
}

function ProductSummary({ fuel, gross, testing, net, rate, amount }: { fuel: Fuel; gross: number; testing: number; net: number; rate: number; amount: number }) {
  return <article className={`product-summary ${fuel.toLowerCase()}`}><h3>{fuel}</h3><dl><div><dt>Total qty</dt><dd>{qty(gross)}</dd></div><div><dt>Testing</dt><dd>{qty(testing)}</dd></div><div><dt>Net qty</dt><dd>{qty(net)}</dd></div><div><dt>Rate</dt><dd>{inr.format(rate)}</dd></div><div className="amount"><dt>{fuel} amount</dt><dd>{inr.format(amount)}</dd></div></dl></article>
}
function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className={`metric ${danger ? 'danger' : ''}`}><span>{label}</span><strong>{value}</strong></div> }
