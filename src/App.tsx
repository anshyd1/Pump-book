import { useEffect, useMemo, useRef, useState } from 'react'
import ReceiptScanner from './ReceiptScanner'
import BrandLogo from './BrandLogo'
import BrandMascot from './BrandMascot'
import PaymentIcon from './PaymentIcon'
import PrintReport from './PrintReport'
import DataHub from './DataHub'
import HomePage from './HomePage'
import SettingsPage from './SettingsPage'
import IntroSplash from './IntroSplash'
import AppChrome from './AppChrome'
import type { AppPage } from './AppChrome'
import type { HistorySummary } from './DataHub'
import { createXlsx, decryptBackup, downloadBlob, encryptedBackup } from './dataTools'
import type { PaymentKind } from './PaymentIcon'
import type { ReadingSlot } from './receiptOcr'
import { applySlipToPair, dayVolumeMismatches, extremeDifferenceOutliers } from './scanPairing'
import { defaultPreferences, loadPreferences } from './preferences'
import type { AppPreferences } from './preferences'
import { checkForAppUpdate, installAppUpdate, openUpdateRelease } from './appUpdater'
import type { UpdateInfo } from './appUpdater'

type Fuel = 'HSD' | 'MS'
type Mode = 'allHsd' | 'mixed'
type Reading = { evening: string; morning: string; photo: string }
type Payments = { udhari: string; paytm: string; fcard: string; phonepe: string; bank: string; kharche: string; cash: string; other: string }
type ScanEvidence = { dayVolumes: string[] }
type Draft = {
  mode: Mode; date: string; note: string; readings: Record<Mode, Reading[]>
  scanEvidence: Record<Mode, ScanEvidence>
  hsdTesting: string; hsdRate: string; msTesting: string; msRate: string; extra: string; payments: Payments
}
type SavedDay = { id: string; savedAt: string; draft: Draft; finalSale: number; balance: number }
type BackupPayload = { version: 1; current: Draft; history: SavedDay[] }
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const VERSION = '4.2.1'
const productMap: Record<Mode, Fuel[]> = {
  allHsd: ['HSD', 'HSD', 'HSD', 'HSD'],
  mixed: ['MS', 'HSD', 'MS', 'HSD']
}
const emptyReadings = (): Reading[] => Array.from({ length: 4 }, () => ({ evening: '', morning: '', photo: '' }))
const emptyEvidence = (): ScanEvidence => ({ dayVolumes: ['', '', '', ''] })
const emptyPayments: Payments = { udhari: '', paytm: '', fcard: '', phonepe: '', bank: '', kharche: '', cash: '', other: '' }
const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const initialDraft = (preferences: AppPreferences = defaultPreferences): Draft => ({
  mode: preferences.defaultMode, date: localDate(), note: '',
  readings: { allHsd: emptyReadings(), mixed: emptyReadings() },
  scanEvidence: { allHsd: emptyEvidence(), mixed: emptyEvidence() },
  hsdTesting: preferences.defaultTesting, hsdRate: preferences.defaultHsdRate,
  msTesting: preferences.defaultTesting, msRate: preferences.defaultMsRate, extra: '',
  payments: { ...emptyPayments }
})
const clean = (value: unknown): string => (value === null || value === undefined || value === 0 || value === '0' || value === '') ? '' : String(value)
const sanitize = (raw: unknown, preferences: AppPreferences = defaultPreferences): Draft => {
  const draft = initialDraft(preferences)
  if (!raw || typeof raw !== 'object') return draft
  const source = raw as Partial<Draft>
  if (source.mode === 'allHsd' || source.mode === 'mixed') draft.mode = source.mode
  if (typeof source.date === 'string' && source.date) draft.date = source.date
  if (typeof source.note === 'string') draft.note = source.note
  for (const mode of ['allHsd', 'mixed'] as Mode[]) {
    const values = source.readings?.[mode]
    draft.readings[mode] = Array.from({ length: 4 }, (_, index) => ({
      evening: clean(values?.[index]?.evening), morning: clean(values?.[index]?.morning), photo: ''
    }))
    draft.scanEvidence[mode].dayVolumes = Array.from({ length: 4 }, (_, index) => clean(source.scanEvidence?.[mode]?.dayVolumes?.[index]))
  }
  draft.hsdTesting = clean(source.hsdTesting); draft.hsdRate = clean(source.hsdRate) || preferences.defaultHsdRate
  draft.msTesting = clean(source.msTesting); draft.msRate = clean(source.msRate) || preferences.defaultMsRate
  draft.extra = clean(source.extra)
  draft.payments = Object.fromEntries((Object.keys(emptyPayments) as (keyof Payments)[]).map(key => [key, clean(source.payments?.[key])])) as Payments
  return draft
}
const num = (value: string) => Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : 0
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = (value: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value)
const pageFromHash = (): AppPage => {
  const value = window.location.hash.replace('#/', '')
  return value === 'closing' || value === 'history' || value === 'settings' ? value : 'home'
}

function Field({ label, value, onChange, step = '0.01', placeholder, type = 'number' }: { label: string; value: string; onChange: (value: string) => void; step?: string; placeholder?: string; type?: 'number' | 'date' | 'text' }) {
  return <label className="field-label"><span>{label}</span><input inputMode={type === 'number' ? 'decimal' : undefined} type={type} step={type === 'number' ? step : undefined} value={value} placeholder={placeholder} onFocus={type === 'number' ? event => event.currentTarget.select() : undefined} onChange={event => onChange(event.target.value)}/></label>
}
function PaymentField({ kind, label, value, onChange }: { kind: PaymentKind; label: string; value: string; onChange: (value: string) => void }) {
  return <label className={`payment-field ${kind}`}><span className="payment-field-head"><PaymentIcon kind={kind}/><span><b>{label}</b><small>{kind === 'cash' ? 'Physical cash' : kind === 'udhari' ? 'Pending credit' : kind === 'kharche' ? 'Day expenses' : 'Received / adjusted'}</small></span></span><span className="money-input"><i>₹</i><input inputMode="decimal" type="number" step="0.01" value={value} placeholder="0" onFocus={event => event.currentTarget.select()} onChange={event => onChange(event.target.value)}/></span></label>
}

export default function App() {
  const STORAGE_KEY = 'pump-book-draft-v4'
  const HISTORY_KEY = 'pump-book-history-v1'
  const [preferences, setPreferences] = useState<AppPreferences>(loadPreferences)
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('pump-book-draft-v3') ?? localStorage.getItem('pump-book-draft-v2')
      return saved ? sanitize(JSON.parse(saved), preferences) : initialDraft(preferences)
    } catch { return initialDraft(preferences) }
  })
  const [history, setHistory] = useState<SavedDay[]>(() => {
    try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) as SavedDay[] : [] } catch { return [] }
  })
  const [page, setPage] = useState<AppPage>(pageFromHash)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const [updateError, setUpdateError] = useState('')

  const map = productMap[draft.mode]
  const fuels = useMemo(() => Array.from(new Set(map)), [map])
  const currentReadings = draft.readings[draft.mode]
  const currentDayVolumes = draft.scanEvidence[draft.mode].dayVolumes
  const diffs = useMemo(() => currentReadings.map(reading => num(reading.evening) - num(reading.morning)), [currentReadings])
  const gross = useMemo(() => map.reduce((result, fuel, index) => { result[fuel] += diffs[index]; return result }, { HSD: 0, MS: 0 } as Record<Fuel, number>), [map, diffs])
  const hsdNet = gross.HSD - num(draft.hsdTesting), msNet = gross.MS - num(draft.msTesting)
  const hsdAmount = hsdNet * num(draft.hsdRate), msAmount = msNet * num(draft.msRate)
  const extraNum = num(draft.extra)
  const finalSale = hsdAmount + msAmount + extraNum
  const accounted = Object.values(draft.payments).reduce((sum, value) => sum + num(value), 0)
  const balance = finalSale - accounted
  const hasNegative = diffs.some(value => value < 0)
  const volumeIssues = dayVolumeMismatches(currentReadings, currentDayVolumes)
  const differenceOutliers = extremeDifferenceOutliers(currentReadings)
  const verifiedReadings = currentReadings.reduce((count, reading) => count + Number(Boolean(reading.morning)) + Number(Boolean(reading.evening)), 0)
  const readingsComplete = verifiedReadings === 8
  const canFinalize = readingsComplete && !hasNegative && volumeIssues.length === 0 && differenceOutliers.length === 0
  const matched = canFinalize && Math.abs(balance) <= 0.05

  const runUpdateCheck = async (silent = false) => {
    if (!silent) { setUpdateBusy(true); setUpdateMessage(''); setUpdateError('') }
    try {
      const info = await checkForAppUpdate(VERSION)
      setUpdateInfo(info)
      if (!silent) setUpdateMessage(info.updateAvailable ? `Version ${info.latestVersion} available है।` : 'Latest version installed है।')
    } catch (error) {
      if (!silent) setUpdateError(error instanceof Error ? error.message : 'Update check failed')
    } finally { if (!silent) setUpdateBusy(false) }
  }
  const installUpdate = async () => {
    if (!updateInfo) { await runUpdateCheck(); return }
    if (updateInfo.platform === 'pwa') {
      setUpdateMessage('PWA files refresh हो रहे हैं…')
      const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
      await registration?.update().catch(() => undefined)
      window.location.reload(); return
    }
    setUpdateBusy(true); setUpdateError(''); setUpdateMessage('APK securely download हो रहा है…')
    try {
      const result = await installAppUpdate(updateInfo)
      if (result.permissionRequired) setUpdateMessage('Android Settings में “Allow from this source” ON करके वापस आएँ और Update दोबारा दबाएँ।')
      else if (result.installerLaunched) setUpdateMessage('Download verified है। Android installer में Update confirm करें।')
      else setUpdateMessage(result.message || 'Update ready है।')
    } catch (error) { setUpdateError(error instanceof Error ? error.message : 'Update install failed') }
    finally { setUpdateBusy(false) }
  }

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setSaveError(null) }
      catch { setSaveError('⚠ Storage full हो गया—backup बनाकर पुराना data साफ करें।') }
      setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft])
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) }, [history])
  useEffect(() => {
    localStorage.setItem('pump-book-preferences-v1', JSON.stringify(preferences))
    const root = document.documentElement
    root.dataset.theme = preferences.theme
    root.dataset.wallpaper = preferences.wallpaper
    root.dataset.density = preferences.density
    root.classList.toggle('reduce-motion', preferences.reduceMotion)
  }, [preferences])
  useEffect(() => {
    if (!preferences.autoUpdateCheck) return
    const timer = window.setTimeout(() => { void runUpdateCheck(true) }, 2_500)
    return () => window.clearTimeout(timer)
    // Auto-check is deliberately keyed only to the user preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.autoUpdateCheck])
  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches)
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallEvt(event as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const navigate = (next: AppPage) => {
    setPage(next)
    const hash = next === 'home' ? '#/' : `#/${next}`
    if (window.location.hash !== hash) window.location.hash = hash
  }
  const doInstall = async () => {
    if (!installEvt) return
    await installEvt.prompt(); const choice = await installEvt.userChoice
    if (choice.outcome === 'accepted') setInstallEvt(null)
  }
  const updateReading = (index: number, key: keyof Reading, value: string) => setDraft(current => ({ ...current, readings: { ...current.readings, [current.mode]: current.readings[current.mode].map((reading, at) => at === index ? { ...reading, [key]: value } : reading) } }))
  const updatePayment = (key: keyof Payments, value: string) => setDraft(current => ({ ...current, payments: { ...current.payments, [key]: value } }))
  const applyScannedReadings = (values: string[], slot: ReadingSlot, dayVolumes: string[], allowOppositeDerivation: boolean) => setDraft(current => {
    const mode = current.mode
    const nextEvidence = current.scanEvidence[mode].dayVolumes.map((known, index) => Number(dayVolumes[index]) > 0 ? dayVolumes[index] : known)
    return {
      ...current,
      readings: { ...current.readings, [mode]: applySlipToPair(current.readings[mode], values, slot, dayVolumes, allowOppositeDerivation) },
      scanEvidence: { ...current.scanEvidence, [mode]: { dayVolumes: nextEvidence } }
    }
  })
  const clearEntries = () => setDraft(current => ({
    ...current,
    readings: { ...current.readings, [current.mode]: emptyReadings() },
    scanEvidence: { ...current.scanEvidence, [current.mode]: emptyEvidence() },
    hsdTesting: preferences.defaultTesting, msTesting: preferences.defaultTesting, extra: '', payments: { ...emptyPayments }
  }))
  const confirmClearDraft = () => { if (window.confirm('Current draft की readings, scan evidence और payments साफ करें?')) clearEntries() }
  const confirmClearHistory = () => { if (history.length && window.confirm(`${history.length} saved records permanently delete करें? पहले backup बनाना बेहतर है।`)) setHistory([]) }

  const fuelGross = (fuel: Fuel) => fuel === 'HSD' ? gross.HSD : gross.MS
  const fuelTest = (fuel: Fuel) => fuel === 'HSD' ? num(draft.hsdTesting) : num(draft.msTesting)
  const fuelNet = (fuel: Fuel) => fuel === 'HSD' ? hsdNet : msNet
  const fuelRate = (fuel: Fuel) => fuel === 'HSD' ? num(draft.hsdRate) : num(draft.msRate)
  const fuelAmount = (fuel: Fuel) => fuel === 'HSD' ? hsdAmount : msAmount
  const amountParts = fuels.map(fuel => inr.format(fuelAmount(fuel)))
  const extraStr = extraNum > 0 ? ` + ${inr.format(extraNum)}` : extraNum < 0 ? ` − ${inr.format(Math.abs(extraNum))}` : ''

  const saveCurrentDay = () => {
    if (!canFinalize) { window.alert('Save रोका गया: पहले सभी 8 readings verify करें और OCR safety warnings ठीक करें।'); return }
    const id = `${draft.date}-${draft.mode}`
    const record: SavedDay = { id, savedAt: new Date().toLocaleString('en-IN'), draft: structuredClone(draft), finalSale, balance }
    setHistory(items => [record, ...items.filter(item => item.id !== id)])
    window.alert('Verified closing History में save हो गई।')
  }
  const historySummary: HistorySummary[] = history.map(item => ({ id: item.id, date: item.draft.date, note: item.draft.note, mode: item.draft.mode === 'allHsd' ? 'Mode 1' : 'Mode 2', finalSale: inr.format(item.finalSale), balance: inr.format(item.balance), savedAt: item.savedAt, matched: Math.abs(item.balance) <= 0.05 }))
  const openRecord = (id: string) => {
    const item = history.find(record => record.id === id)
    if (!item) return
    setDraft(sanitize(item.draft, preferences)); navigate('closing')
  }
  const exportExcel = () => {
    const detailRows: (string | number)[][] = [['Date', 'Mode', 'Note', 'T1 Opening', 'T1 Closing', 'T2 Opening', 'T2 Closing', 'T3 Opening', 'T3 Closing', 'T4 Opening', 'T4 Closing', 'Final Sale', 'Balance']]
    history.forEach(item => detailRows.push([item.draft.date, item.draft.mode, item.draft.note, ...item.draft.readings[item.draft.mode].flatMap(reading => [Number(reading.morning) || 0, Number(reading.evening) || 0]), item.finalSale, item.balance]))
    const paymentRows: (string | number)[][] = [['Date', 'Udhari', 'Paytm', 'F-Card', 'PhonePe', 'Bank', 'Kharche', 'Cash', 'Other']]
    history.forEach(item => paymentRows.push([item.draft.date, ...Object.values(item.draft.payments).map(value => Number(value) || 0)]))
    downloadBlob(createXlsx([{ name: 'Daily Closing', rows: detailRows }, { name: 'Payments', rows: paymentRows }]), `pump-book-${draft.date}.xlsx`)
  }
  const shareCurrent = async () => {
    if (!canFinalize) { window.alert('Share रोका गया: current closing verified नहीं है।'); return }
    const lines = [`Pump Book — ${draft.date}`, draft.note || 'Daily closing', ...map.map((fuel, index) => `T${index + 1} ${fuel}: ${currentReadings[index].morning} → ${currentReadings[index].evening} = ${qty(diffs[index])} L`), `Final sale: ${inr.format(finalSale)}`, `Accounted: ${inr.format(accounted)}`, `Balance: ${inr.format(balance)}`, matched ? 'Status: MATCH' : 'Status: CHECK']
    const text = lines.join('\n')
    if (navigator.share) await navigator.share({ title: `Pump Book ${draft.date}`, text }).catch(() => undefined)
    else { await navigator.clipboard.writeText(text); window.alert('Report clipboard में copy हो गई।') }
  }
  const backupData = async (password: string) => downloadBlob(await encryptedBackup({ version: 1, current: draft, history } satisfies BackupPayload, password), `pump-book-backup-${draft.date}.pumpbook`)
  const restoreData = async (file: File, password: string) => {
    try {
      const restored = await decryptBackup(file, password) as BackupPayload
      if (restored.version !== 1 || !Array.isArray(restored.history)) throw new Error('Invalid backup')
      setDraft(sanitize(restored.current, preferences)); setHistory(restored.history); window.alert(`${restored.history.length} records restore हो गए।`)
    } catch { window.alert('Backup open नहीं हुआ—password या file check करें।') }
  }

  const printFinal = canFinalize ? inr.format(finalSale) : 'NOT VERIFIED'
  return <>
    <IntroSplash reduceMotion={preferences.reduceMotion}/>
    <PrintReport
      date={draft.date} note={draft.note}
      mode={draft.mode === 'allHsd' ? 'Mode 1 · HSD / HSD / HSD / HSD' : 'Mode 2 · MS / HSD / MS / HSD'}
      readings={map.map((fuel, index) => ({ nozzle: `T${index + 1}`, fuel, opening: currentReadings[index].morning || '—', closing: currentReadings[index].evening || '—', sale: qty(diffs[index]) }))}
      fuels={fuels.map(fuel => ({ fuel, gross: qty(fuelGross(fuel)), testing: qty(fuelTest(fuel)), net: qty(fuelNet(fuel)), rate: inr.format(fuelRate(fuel)), amount: inr.format(fuelAmount(fuel)) }))}
      payments={(Object.entries({ udhari: 'Udhari', paytm: 'Paytm', fcard: 'F-Card', phonepe: 'PhonePe', bank: 'Bank', kharche: 'Kharche', cash: 'Cash', other: 'Other' }) as [keyof Payments, string][]).map(([key, label]) => ({ label, value: inr.format(num(draft.payments[key])) }))}
      finalSale={printFinal} accounted={inr.format(accounted)} balance={canFinalize ? inr.format(balance) : 'NOT VERIFIED'} matched={matched}
    />
    <AppChrome page={page} drawerOpen={drawerOpen} onDrawer={setDrawerOpen} onNavigate={navigate} onPrint={() => canFinalize ? window.print() : window.alert('Print रोका गया: पहले सभी readings verify करें।')} version={VERSION}>
      {updateInfo?.updateAvailable && page !== 'settings' && <button className="global-update-banner" onClick={() => navigate('settings')}><span>⇧</span><b>Pump Book {updateInfo.latestVersion} available</b><small>Tap to update inside app</small><i>›</i></button>}
      {page === 'home' && <HomePage
        date={draft.date} note={draft.note} mode={draft.mode === 'mixed' ? 'Mode 2 · MS / HSD / MS / HSD' : 'Mode 1 · All HSD'}
        verified={verifiedReadings} complete={readingsComplete} valid={!hasNegative && volumeIssues.length === 0 && differenceOutliers.length === 0}
        finalSale={inr.format(finalSale)} balance={inr.format(balance)} matched={matched}
        historyCount={history.length} recent={historySummary.slice(0, 3)} onNavigate={navigate} onOpenRecord={openRecord}
      />}

      {page === 'closing' && <div className="shell closing-shell">
        <header className="hero closing-hero">
          <div className="hero-orb orb-one"/><div className="hero-orb orb-two"/>
          <div className="hero-top"><div className="brand"><div className="brand-logo-new"><BrandLogo/></div><div className="brand-copy"><span className="brand-kicker">SMART DAILY CLOSING · BY ANSH</span><strong>Pump <em>Book</em></strong><span>Scan readings. Match every rupee.</span></div></div><div className="brand-status"><span className="live-dot"/>Auto-save on</div></div>
          <div className="hero-chips"><span>✦ Smart OCR</span><span>⌁ Offline-ready</span><span>♢ ShDayVol verified</span></div>
          <div className="hero-row"><Field label="Working date" value={draft.date} type="date" onChange={date => setDraft(current => ({ ...current, date }))}/><label className="field-label"><span>Machine / Staff note</span><input value={draft.note} placeholder="M1 · Ramesh" onChange={event => setDraft(current => ({ ...current, note: event.target.value }))}/></label></div>
        </header>

        <div className="journey" aria-label="Daily closing workflow"><div className="journey-step active"><i>01</i><span><b>Scan</b><small>Readings</small></span></div><div className="journey-line"/><div className="journey-step"><i>02</i><span><b>Set</b><small>Rates</small></span></div><div className="journey-line"/><div className="journey-step"><i>03</i><span><b>Review</b><small>Sale</small></span></div><div className="journey-line"/><div className="journey-step"><i>04</i><span><b>Match</b><small>Cash</small></span></div></div>
        <nav className="mode-tabs" aria-label="Calculation mode"><button className={draft.mode === 'allHsd' ? 'active' : ''} onClick={() => setDraft(current => ({ ...current, mode: 'allHsd' }))}><b>Mode 1</b><span>HSD · HSD · HSD · HSD</span></button><button className={draft.mode === 'mixed' ? 'active' : ''} onClick={() => setDraft(current => ({ ...current, mode: 'mixed' }))}><b>Mode 2</b><span>MS · HSD · MS · HSD</span></button></nav>

        <main>
          <section className="card">
            <div className="section-head"><div className="section-title"><span className="section-icon scan-icon">⌗</span><div><p className="eyebrow">Step 01 · Capture</p><h2>Totalizer readings</h2><p className="section-sub">सुबह + शाम की slips से 8 verified readings</p></div></div><div className="section-tools"><ReceiptScanner existingReadings={currentReadings} knownDayVolumes={currentDayVolumes} onApply={applyScannedReadings}/></div></div>
            <div className="totalizer-grid">{map.map((fuel, index) => {
              const issue = volumeIssues.find(item => item.nozzle === index + 1)
              const outlier = differenceOutliers.find(item => item.nozzle === index + 1)
              return <article className={`totalizer ${issue || outlier ? 'invalid-reading' : ''}`} key={`${draft.mode}-${index}`}><div className="totalizer-head"><b><small>Nozzle</small>T{index + 1}</b><span className={`fuel ${fuel.toLowerCase()}`}>{fuel}</span></div><Field label="Evening / Closing" value={currentReadings[index].evening} step="0.001" placeholder="0.000" onChange={value => updateReading(index, 'evening', value)}/><Field label="Morning / Opening" value={currentReadings[index].morning} step="0.001" placeholder="0.000" onChange={value => updateReading(index, 'morning', value)}/><div className={`difference ${diffs[index] < 0 || issue || outlier ? 'bad' : ''}`}><span>Difference</span><strong>{qty(diffs[index])}</strong></div>{currentDayVolumes[index] && <div className={`dayvol-proof ${issue ? 'bad' : ''}`}><span>Slip ShDayVol</span><b>{currentDayVolumes[index]}</b><i>{issue ? 'Mismatch' : 'Verified ✓'}</i></div>}{outlier && <div className="dayvol-proof bad"><span>Safety outlier</span><b>{qty(outlier.difference)} L</b><i>Other nozzles से असामान्य</i></div>}</article>
            })}</div>
            {hasNegative && <div className="alert">Negative difference मिला है—Evening और Morning reading check करें।</div>}
            {volumeIssues.map(issue => <div className="alert safety-alert" key={issue.nozzle}><b>T{issue.nozzle} blocked:</b> Closing − Opening {qty(issue.calculated)} L है, लेकिन printed ShDayVol {qty(issue.printed)} L है। Final Sale रोक दी गई है।</div>)}
            {differenceOutliers.map(issue => <div className="alert safety-alert" key={`outlier-${issue.nozzle}`}><b>T{issue.nozzle} safety hold:</b> {qty(issue.difference)} L बाकी nozzles के median {qty(issue.median)} L से 100× से ज्यादा है। Opening/Closing manually verify करें।</div>)}
            {!readingsComplete && <div className="verification-note"><b>{verifiedReadings}/8 readings entered</b><span>Final sale के लिए सभी Morning और Evening values जरूरी हैं।</span></div>}
          </section>

          <section className="card"><div className="section-head"><div><p className="eyebrow">Step 02 · Configure</p><h2>Testing &amp; editable rates</h2></div><span className="help">Yellow fields editable</span></div><div className="settings-grid"><div className="setting hsd"><h3>HSD settings</h3><div className="two"><Field label="Testing qty" value={draft.hsdTesting} step="0.001" placeholder="0.000" onChange={hsdTesting => setDraft(current => ({ ...current, hsdTesting }))}/><Field label="Rate (₹/L)" value={draft.hsdRate} placeholder="e.g. 95.50" onChange={hsdRate => setDraft(current => ({ ...current, hsdRate }))}/></div></div>{draft.mode === 'mixed' && <div className="setting ms"><h3>MS settings</h3><div className="two"><Field label="Testing qty" value={draft.msTesting} step="0.001" placeholder="0.000" onChange={msTesting => setDraft(current => ({ ...current, msTesting }))}/><Field label="Rate (₹/L)" value={draft.msRate} placeholder="e.g. 102.01" onChange={msRate => setDraft(current => ({ ...current, msRate }))}/></div></div>}<div className="setting extra"><h3>Extra adjustment</h3><Field label="Plus (+) / Minus (−)" value={draft.extra} placeholder="+ / −" onChange={extra => setDraft(current => ({ ...current, extra }))}/></div></div></section>

          <section className="card"><div className="section-head"><div><p className="eyebrow">Step 03 · Verify</p><h2>Fuel sale summary</h2></div><span className={`soft-badge ${canFinalize ? 'live' : ''}`}>{canFinalize ? 'Verified calculation' : 'Safety hold'}</span></div><div className="summary-grid"><ProductSummary fuel="HSD" gross={gross.HSD} testing={num(draft.hsdTesting)} net={hsdNet} rate={num(draft.hsdRate)} amount={hsdAmount}/>{draft.mode === 'mixed' && <ProductSummary fuel="MS" gross={gross.MS} testing={num(draft.msTesting)} net={msNet} rate={num(draft.msRate)} amount={msAmount}/>}</div>
            <div className={`sale-total ${canFinalize ? '' : 'sale-blocked'}`}><div><span>{canFinalize ? 'FINAL FUEL SALE' : 'FINAL SALE ON HOLD'}</span><strong>{canFinalize ? inr.format(finalSale) : 'Verify readings'}</strong><small>{canFinalize ? 'All totalizers passed safety checks' : volumeIssues.length ? 'ShDayVol mismatch detected' : differenceOutliers.length ? 'Extreme nozzle outlier detected' : `${8 - verifiedReadings} readings missing`}</small></div><span className="pill">{canFinalize ? 'Calculated ✓' : 'Not final'}</span></div>
            <div className="calc-block"><h3>Full calculation — {canFinalize ? 'पूरा हिसाब' : 'provisional preview'}</h3><div className="calc-wrap"><table className="calc-table"><thead><tr><th>Fuel</th><th>Total qty</th><th>Testing</th><th>Net qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{fuels.map(fuel => <tr key={fuel}><td><span className={`fuel ${fuel.toLowerCase()}`}>{fuel}</span></td><td>{qty(fuelGross(fuel))}</td><td>{qty(fuelTest(fuel))}</td><td>{qty(fuelNet(fuel))}</td><td>{inr.format(fuelRate(fuel))}</td><td>{inr.format(fuelAmount(fuel))}</td></tr>)}</tbody></table></div><div className="formula-lines">{fuels.map(fuel => <div key={fuel}>{fuel}: {qty(fuelNet(fuel))} L × {inr.format(fuelRate(fuel))} = <b>{inr.format(fuelAmount(fuel))}</b></div>)}{extraStr && <div>Extra: {extraStr}</div>}<div className="final-line">{canFinalize ? <>FINAL = {amountParts.join(' + ')}{extraStr} = <b>{inr.format(finalSale)}</b></> : <b>Not final—verification required</b>}</div></div><div className="nozzle-chips">{map.map((fuel, index) => <span key={index} className={fuel.toLowerCase()}>T{index + 1} · {fuel} = {qty(diffs[index])}</span>)}</div></div>
          </section>

          <section className="card"><div className="section-head"><div className="section-title"><span className="section-icon wallet-icon">▣</span><div><p className="eyebrow">Step 04 · Reconcile</p><h2>Payment, udhari &amp; cash</h2><p className="section-sub">Sale का पूरा मिलान</p></div></div><span className="soft-badge">Final step</span></div><div className="payment-grid">{(Object.entries({ udhari: 'Udhari', paytm: 'Paytm', fcard: 'F-Card', phonepe: 'PhonePe', bank: 'Bank', kharche: 'Kharche', cash: 'Cash', other: 'Other' }) as [PaymentKind, string][]).map(([key, label]) => <PaymentField key={key} kind={key} label={label} value={draft.payments[key]} onChange={value => updatePayment(key, value)}/>)}</div><div className="recon-grid"><Metric label="Final fuel sale" value={canFinalize ? inr.format(finalSale) : 'Not verified'}/><Metric label="Total accounted" value={inr.format(accounted)}/><Metric label="Balance / fault" value={canFinalize ? inr.format(balance) : '—'} danger={canFinalize && !matched}/></div><div role="status" className={`match ${matched ? '' : 'check'}`}>{!canFinalize ? 'WAIT — readings verification बाकी है' : matched ? 'MATCH — हिसाब बराबर है' : `CHECK — ${inr.format(balance)} का difference`}</div></section>

          {saveError && <div className="alert">{saveError}</div>}
          <div className="actions"><div className="actions-left">{!standalone && installEvt && <button className="install-btn" onClick={doInstall}>📲 Install app</button>}<span className="save-status">{savedAt ? `Auto-saved ✓ ${savedAt}` : 'Auto-save on'}</span></div><div className="actions-right"><button className="secondary" onClick={confirmClearDraft}>Clear entries</button><button className="secondary" onClick={saveCurrentDay} disabled={!canFinalize}>＋ Save day</button><button className="primary" onClick={() => window.print()} disabled={!canFinalize}>🖨 Print report</button></div></div>
          {!standalone && !installEvt && <p className="install-note">PWA ready: browser menu से “Add to Home Screen” चुनें।</p>}
        </main>
        <footer><BrandMascot compact/><div><b>Pump Book · by Ansh</b><span>Faster, safer daily closing · Data आपके device पर रहता है</span></div></footer>
      </div>}

      {page === 'history' && <DataHub items={historySummary} onSave={saveCurrentDay} onOpen={openRecord} onDelete={id => { if (window.confirm('यह saved day delete करें?')) setHistory(items => items.filter(item => item.id !== id)) }} onExcel={exportExcel} onShare={() => void shareCurrent()} onBackup={password => void backupData(password)} onRestore={(file, password) => void restoreData(file, password)}/>}
      {page === 'settings' && <SettingsPage
        preferences={preferences} onChange={setPreferences} onClearDraft={confirmClearDraft} onClearHistory={confirmClearHistory}
        historyCount={history.length} version={VERSION} updateInfo={updateInfo} updateBusy={updateBusy} updateMessage={updateMessage} updateError={updateError}
        onCheckUpdate={() => void runUpdateCheck()} onInstallUpdate={() => void installUpdate()}
        onOpenRelease={() => { if (updateInfo?.releaseUrl) void openUpdateRelease(updateInfo.releaseUrl) }}
      />}
    </AppChrome>
  </>
}

function ProductSummary({ fuel, gross, testing, net, rate, amount }: { fuel: Fuel; gross: number; testing: number; net: number; rate: number; amount: number }) {
  return <article className={`product-summary ${fuel.toLowerCase()}`}><h3>{fuel}</h3><dl><div><dt>Total qty</dt><dd>{qty(gross)}</dd></div><div><dt>Testing</dt><dd>{qty(testing)}</dd></div><div><dt>Net qty</dt><dd>{qty(net)}</dd></div><div><dt>Rate</dt><dd>{inr.format(rate)}</dd></div><div className="amount"><dt>{fuel} amount</dt><dd>{inr.format(amount)}</dd></div></dl></article>
}
function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div className={`metric ${danger ? 'danger' : ''}`}><span>{label}</span><strong>{value}</strong></div> }
