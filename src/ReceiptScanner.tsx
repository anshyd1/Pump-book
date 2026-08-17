import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { scanNativeReceipt, scanReceipt } from './receiptOcr'
import BrandMascot from './BrandMascot'
import SmartCamera from './SmartCamera'
import { nativeMlKitAvailable } from './nativeOcr'
import { exportScanDiagnostics } from './scanDiagnostics'
import type { ReadingSlot, ScanResult } from './receiptOcr'
import { dayVolumeMismatches } from './scanPairing'

type ExistingReading = { morning: string; evening: string }
type Props = {
  existingReadings: ExistingReading[]
  knownDayVolumes?: string[]
  onApply: (readings: string[], slot: ReadingSlot, dayVolumes: string[], allowOppositeDerivation: boolean) => void
}

export default function ReceiptScanner({ existingReadings, knownDayVolumes = ['', '', '', ''], onApply }: Props) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [readings, setReadings] = useState(['', '', '', ''])
  const [dayVolumes, setDayVolumes] = useState(['', '', '', ''])
  const [confidence, setConfidence] = useState<number | null>(null)
  const [slot, setSlot] = useState<ReadingSlot | null>(null)
  const [scannedSlots, setScannedSlots] = useState<Set<ReadingSlot>>(() => new Set())
  const [preview, setPreview] = useState('')
  const [rawText, setRawText] = useState('')
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const [diagnosticFile, setDiagnosticFile] = useState<File | null>(null)
  const nativeScanner = nativeMlKitAvailable()

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    if (existingReadings.every(reading => !reading.morning && !reading.evening)) setScannedSlots(new Set())
  }, [existingReadings])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  const progressUpdate = (value: number, nextStatus: string) => {
    setProgress(Math.round(value * 100))
    setStatus(
      nextStatus === 'document scanner' ? 'Document के चारों किनारे ठीक कर रहे हैं…'
        : nextStatus === 'native gallery' ? 'Photo सीधे native ML Kit को दे रहे हैं…'
          : nextStatus === 'native structured' ? 'ML Kit boxes से Nozzle readings मिला रहे हैं…'
          : nextStatus === 'recognizing text' ? 'Fast OCR से 4 readings पढ़ रहे हैं…'
            : nextStatus === 'detecting receipt' ? 'Receipt auto-frame हो रही है…'
              : 'OCR engine तैयार हो रहा है…'
    )
  }
  const prepareScan = () => {
    setOpen(true); setBusy(true); setError('')
    setReadings(['', '', '', '']); setDayVolumes(['', '', '', ''])
    setConfidence(null); setRawText(''); setLastResult(null)
    setProgress(0); setStatus('Scanner तैयार हो रहा है…')
  }
  const acceptResult = (result: ScanResult) => {
    setReadings(result.readings)
    setDayVolumes(result.dayVolumes)
    setConfidence(result.confidence)
    setRawText(result.rawText)
    setLastResult(result)
    // Never retain/default a previous slot when this receipt's printed time
    // was not confidently recognized. The user must explicitly choose.
    setSlot(result.suggestedSlot)
    if (!result.readings.some(Boolean)) setError('कोई reading साफ नहीं मिली। पूरी slip frame में रखकर अच्छी रोशनी में दोबारा scan करें।')
  }
  const startScan = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    setDiagnosticFile(file)
    prepareScan()
    try {
      acceptResult(await scanReceipt(file, progressUpdate))
    } catch (scanError) {
      console.error(scanError)
      setError('Scan नहीं हो पाया। साफ फोटो से दोबारा कोशिश करें।')
    } finally {
      setBusy(false); setProgress(100)
    }
  }
  const startNativeScan = async (source: 'document' | 'gallery' = 'document') => {
    prepareScan()
    setDiagnosticFile(null)
    try {
      const result = await scanNativeReceipt(progressUpdate, source)
      if (!result) { setOpen(false); return }
      if (preview) URL.revokeObjectURL(preview)
      setPreview(result.previewUri ?? '')
      acceptResult(result)
    } catch (scanError) {
      console.error(scanError)
      setError('Native document scan नहीं हुआ। Gallery Upload से PWA fallback इस्तेमाल करें।')
    } finally {
      setBusy(false); setProgress(100)
    }
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void startScan(file)
  }

  const close = () => {
    if (busy) return
    setOpen(false)
  }

  const effectiveReadings = readings.map((value, index) => {
    if (value) return value
    if (dayVolumes[index] === '') return ''
    const day = Number(dayVolumes[index]), existing = existingReadings[index]
    if (slot === 'evening' && existing?.morning) return (Number(existing.morning) + day).toFixed(3)
    // A morning receipt normally prints ShDayVol 0.000. Never use that to
    // copy an existing Evening value into Morning.
    return ''
  })
  const missingLabels = effectiveReadings.map((value, index) => value ? '' : `T${index + 1}`).filter(Boolean)
  const invalidOrderLabels = effectiveReadings.map((value, index) => {
    if (!slot || !value) return ''
    const existing = existingReadings[index]
    if (slot === 'evening' && existing?.morning && Number(value) < Number(existing.morning)) return `T${index + 1}`
    if (slot === 'morning' && existing?.evening && Number(value) > Number(existing.evening)) return `T${index + 1}`
    return ''
  }).filter(Boolean)
  const verificationDayVolumes = dayVolumes.map((value, index) => Number(value) > 0 ? value : knownDayVolumes[index] ?? '')
  const candidatePair = existingReadings.map((reading, index) => slot === 'morning'
    ? { ...reading, morning: effectiveReadings[index] || reading.morning }
    : slot === 'evening'
      ? { ...reading, evening: effectiveReadings[index] || reading.evening }
      : reading
  )
  const dayVolumeIssues = dayVolumeMismatches(candidatePair, verificationDayVolumes)
  const displayConfidence = effectiveReadings.filter(Boolean).length * 25
  const apply = () => {
    if (!slot || invalidOrderLabels.length || dayVolumeIssues.length || !effectiveReadings.some(Boolean)) return
    const opposite: ReadingSlot = slot === 'morning' ? 'evening' : 'morning'
    const oppositeKey = opposite
    const hasOppositeEvidence = scannedSlots.has(opposite) || existingReadings.some(reading => Boolean(reading[oppositeKey]))
    onApply(effectiveReadings, slot, dayVolumes, hasOppositeEvidence)
    setScannedSlots(previous => new Set(previous).add(slot))
    setOpen(false)
  }

  return <>
    <div className="scan-actions">
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <button type="button" className="scan-btn" onClick={() => nativeScanner ? void startNativeScan() : setCameraOpen(true)}><span className="scan-btn-icon">⌗</span><span>Smart Scan<small>{nativeScanner ? 'Native document scanner' : 'Premium camera'}</small></span><i>→</i></button>
      <button type="button" className="scan-gallery" title="Gallery की slip scan करें" aria-label="Gallery की slip scan करें" onClick={() => nativeScanner ? void startNativeScan('gallery') : galleryRef.current?.click()}><span>▧</span><small>Upload</small></button>
    </div>

    {open && <div className="scanner-backdrop" role="presentation" onClick={close}>
      <section className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title" onClick={event => event.stopPropagation()}>
        <div className="scanner-head">
          <div className="scanner-brand"><BrandMascot compact scanning={busy}/><div><p className="eyebrow">PUMP VISION · ML KIT 4.2.0</p><h2 id="scanner-title">Slip Intelligence</h2><span>Auto enhance · deskew · read</span></div></div>
          <button type="button" className="scanner-close" disabled={busy} onClick={close}>✕</button>
        </div>

        <div className="scanner-body">
          {preview && <div className={`scanner-visual ${busy ? 'scanning' : ''}`}><img className="scanner-preview" src={preview} alt="Scan की गई pump slip"/><div className="scan-corners"><i/><i/><i/><i/></div><div className="scanner-laser"/><span className="visual-badge">AUTO FRAME</span></div>}
          <div className="scanner-result">
            {busy ? <div className="scan-progress" role="status">
              <div className="scanner-mascot"><BrandMascot scanning/></div>
              <div><strong>{status}</strong><p>Photo को साफ करके numbers खोज रहे हैं</p></div>
              <div className="progress-track"><span style={{ width: `${Math.max(4, progress)}%` }} /></div>
              <div className="scan-stages"><span className={progress > 5 ? 'done' : 'active'}>Enhance</span><span className={progress > 30 ? 'done' : ''}>Deskew</span><span className={progress > 60 ? 'done' : ''}>Read</span><span className={progress >= 100 ? 'done' : ''}>Verify</span></div>
              <small>{progress}% · {nativeScanner ? 'capture confirm होने के बाद target 2 sec से कम' : 'PWA fallback सामान्यतः 5–12 sec'}</small>
            </div> : <>
              <div className="scan-result-head"><div><span className="result-kicker">SCAN COMPLETE</span><strong>CumVolume readings</strong></div>{confidence !== null && <span className={`confidence ${displayConfidence === 100 ? 'perfect' : ''}`}><b>{displayConfidence}%</b><small>{displayConfidence > confidence ? 'paired' : 'confidence'}</small></span>}</div>
              <div className="slot-picker">
                <div><strong>किस समय की slip?</strong><span>सही जगह भरने के लिए सुबह या शाम चुनें</span></div>
                <div className="slot-buttons">
                  <button type="button" className={slot === 'morning' ? 'active' : ''} onClick={() => setSlot('morning')}>🌅 सुबह / Opening</button>
                  <button type="button" className={slot === 'evening' ? 'active' : ''} onClick={() => setSlot('evening')}>🌆 शाम / Closing</button>
                </div>
              </div>
              <p className="scan-warning">📄 पूरी slip को ऊपर से नीचे तक सीधा frame करें। Confirm से पहले चारों numbers जरूर मिलाएँ।</p>
              <div className="scan-reading-grid">{effectiveReadings.map((reading, index) => <label key={index}>
                <span>T{index + 1}</span>
                <input inputMode="decimal" value={reading} placeholder="नहीं मिली—यहाँ भरें" onChange={event => setReadings(values => values.map((value, i) => i === index ? event.target.value : value))} />
              </label>)}</div>
              {missingLabels.length > 0 && readings.some(Boolean) && <div className="scan-error">{missingLabels.join(', ')} इस photo में साफ verify नहीं हुई। पहले ये reading Confirm करें, फिर दूसरी समय वाली slip scan करें—ShDayVol से missing totalizer safely निकलेगा।</div>}
              {invalidOrderLabels.length > 0 && <div className="scan-error">{invalidOrderLabels.join(', ')} की Closing, Opening से कम पढ़ी गई है। यह CumVolume नहीं हो सकती—Auto Fill रोक दिया गया है।</div>}
              {dayVolumeIssues.map(issue => <div className="scan-error" key={issue.nozzle}><b>T{issue.nozzle} safety check failed.</b> Closing − Opening {issue.calculated.toFixed(3)} L है, लेकिन slip का ShDayVol {issue.printed.toFixed(3)} L है। गलत neighbouring field save नहीं की गई।</div>)}
              {displayConfidence > (confidence ?? 0) && <div className="scan-derived">✓ Missing reading को दूसरी slip + ShDayVol से calculate किया गया है। Confirm से पहले मिला लें।</div>}
              {error && <div className="scan-error">{error}</div>}
              {lastResult?.diagnostics.native && <div className="scan-derived">⏱ Native processing: {lastResult.diagnostics.native.processingMs} ms · ML Kit OCR: {lastResult.diagnostics.native.ocrMs} ms · {lastResult.diagnostics.native.associations.length} boxed fields</div>}
              {rawText && <details className="ocr-text"><summary>OCR text देखें</summary><pre>{rawText}</pre></details>}
              {lastResult && <button type="button" className="secondary" onClick={() => void exportScanDiagnostics(lastResult, diagnosticFile, preview)}>⬇ Diagnostics ZIP</button>}
            </>}
          </div>
        </div>

        <div className="scanner-footer">
          {!busy && <button type="button" className="secondary" onClick={() => nativeScanner ? void startNativeScan() : setCameraOpen(true)}>⌗ फिर scan करें</button>}
          <button type="button" className="primary" disabled={busy || !slot || invalidOrderLabels.length > 0 || dayVolumeIssues.length > 0 || !effectiveReadings.some(Boolean)} onClick={apply}>✓ {dayVolumeIssues.length ? 'ShDayVol mismatch—check readings' : slot ? `${slot === 'morning' ? 'Morning' : 'Evening'} Auto Fill` : 'पहले Morning / Evening चुनें'}</button>
        </div>
      </section>
    </div>}
    <SmartCamera open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={file => void startScan(file)}/>
  </>
}
