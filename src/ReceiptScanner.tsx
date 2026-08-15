import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { scanReceipt } from './receiptOcr'
import BrandMascot from './BrandMascot'
import type { ReadingSlot } from './receiptOcr'

type Props = {
  onApply: (readings: string[], slot: ReadingSlot) => void
}

export default function ReceiptScanner({ onApply }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [readings, setReadings] = useState(['', '', '', ''])
  const [confidence, setConfidence] = useState<number | null>(null)
  const [slot, setSlot] = useState<ReadingSlot>('evening')
  const [preview, setPreview] = useState('')
  const [rawText, setRawText] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const startScan = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    setOpen(true)
    setBusy(true)
    setError('')
    setReadings(['', '', '', ''])
    setConfidence(null)
    setRawText('')
    setProgress(0)
    setStatus('Scanner तैयार हो रहा है…')
    try {
      const result = await scanReceipt(file, (value, nextStatus) => {
        setProgress(Math.round(value * 100))
        setStatus(nextStatus === 'recognizing text' ? '4 CumVolume readings पढ़ी जा रही हैं…' : 'Scanner तैयार हो रहा है…')
      })
      setReadings(result.readings)
      setConfidence(result.confidence)
      setRawText(result.rawText)
      if (result.suggestedSlot) setSlot(result.suggestedSlot)
      if (!result.readings.some(Boolean)) setError('Reading साफ नहीं मिली। फोटो सीधी, पास से और अच्छी रोशनी में लेकर दोबारा scan करें।')
    } catch (scanError) {
      console.error(scanError)
      setError('Scan नहीं हो पाया। Internet check करके या साफ फोटो से दोबारा कोशिश करें।')
    } finally {
      setBusy(false)
      setProgress(100)
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

  const apply = () => {
    if (!readings.some(Boolean)) return
    onApply(readings, slot)
    setOpen(false)
  }

  return <>
    <div className="scan-actions">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <button type="button" className="scan-btn" onClick={() => cameraRef.current?.click()}><span className="scan-btn-icon">⌗</span><span>Smart Scan<small>Camera</small></span><i>→</i></button>
      <button type="button" className="scan-gallery" title="Gallery की slip scan करें" aria-label="Gallery की slip scan करें" onClick={() => galleryRef.current?.click()}><span>▧</span><small>Upload</small></button>
    </div>

    {open && <div className="scanner-backdrop" role="presentation" onClick={close}>
      <section className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title" onClick={event => event.stopPropagation()}>
        <div className="scanner-head">
          <div className="scanner-brand"><BrandMascot compact scanning={busy}/><div><p className="eyebrow">PUMP VISION · SMART OCR 2.1</p><h2 id="scanner-title">Slip Intelligence</h2><span>Auto enhance · deskew · read</span></div></div>
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
              <small>{progress}% · पहली scan पर OCR engine download हो सकता है</small>
            </div> : <>
              <div className="scan-result-head"><div><span className="result-kicker">SCAN COMPLETE</span><strong>CumVolume readings</strong></div>{confidence !== null && <span className={`confidence ${confidence === 100 ? 'perfect' : ''}`}><b>{confidence}%</b><small>confidence</small></span>}</div>
              <div className="slot-picker">
                <div><strong>किस समय की slip?</strong><span>सही जगह भरने के लिए सुबह या शाम चुनें</span></div>
                <div className="slot-buttons">
                  <button type="button" className={slot === 'morning' ? 'active' : ''} onClick={() => setSlot('morning')}>🌅 सुबह / Opening</button>
                  <button type="button" className={slot === 'evening' ? 'active' : ''} onClick={() => setSlot('evening')}>🌆 शाम / Closing</button>
                </div>
              </div>
              <p className="scan-warning">📄 पूरी slip को ऊपर से नीचे तक सीधा frame करें। Confirm से पहले चारों numbers जरूर मिलाएँ।</p>
              <div className="scan-reading-grid">{readings.map((reading, index) => <label key={index}>
                <span>T{index + 1}</span>
                <input inputMode="decimal" value={reading} placeholder="नहीं मिली—यहाँ भरें" onChange={event => setReadings(values => values.map((value, i) => i === index ? event.target.value : value))} />
              </label>)}</div>
              {error && <div className="scan-error">{error}</div>}
              {rawText && <details className="ocr-text"><summary>OCR text देखें</summary><pre>{rawText}</pre></details>}
            </>}
          </div>
        </div>

        <div className="scanner-footer">
          {!busy && <button type="button" className="secondary" onClick={() => cameraRef.current?.click()}>📷 फिर scan करें</button>}
          <button type="button" className="primary" disabled={busy || !readings.some(Boolean)} onClick={apply}>✓ {slot === 'morning' ? 'Morning' : 'Evening'} Auto Fill</button>
        </div>
      </section>
    </div>}
  </>
}
