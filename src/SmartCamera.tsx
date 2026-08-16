import { useEffect, useRef, useState } from 'react'

type Props = { open: boolean; onClose: () => void; onCapture: (file: File) => void }

type TorchTrack = MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean } }

export default function SmartCamera({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torch, setTorch] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const stop = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (!open) { stop(); return }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let cancelled = false
    const start = async () => {
      stop(); setReady(false); setError(''); setTorch(false)
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable')
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        })
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        const track = stream.getVideoTracks()[0] as TorchTrack
        const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number; max: number }; focusMode?: string[] }) | undefined
        setTorchSupported(Boolean(caps?.torch))
        const advanced: MediaTrackConstraintSet[] = []
        if (caps?.zoom) advanced.push({ zoom: caps.zoom.min } as MediaTrackConstraintSet)
        if (caps?.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' } as MediaTrackConstraintSet)
        if (advanced.length) await track.applyConstraints({ advanced }).catch(() => undefined)
        setReady(true)
      } catch (reason) {
        console.error(reason)
        setError('Camera permission नहीं मिला। Browser permission Allow करें या Gallery Upload इस्तेमाल करें।')
      }
    }
    void start()
    return () => { cancelled = true; stop(); document.body.style.overflow = previousOverflow }
  }, [open, facing])

  const close = () => { stop(); onClose() }
  const flip = () => setFacing(value => value === 'environment' ? 'user' : 'environment')
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0] as TorchTrack | undefined
    if (!track) return
    try {
      const next = !torch
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch(next)
    } catch { setTorchSupported(false) }
  }
  const capture = async () => {
    const video = videoRef.current
    if (!video || !ready || !video.videoWidth) return
    setCapturing(true)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const context = canvas.getContext('2d')!
    if (facing === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1) }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      setCapturing(false)
      if (!blob) return
      stop(); onClose(); onCapture(new File([blob], `pump-slip-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', .94)
  }

  if (!open) return null
  return <div className="smart-camera" role="dialog" aria-modal="true" aria-label="Pump Vision camera">
    <video ref={videoRef} playsInline muted className={facing === 'user' ? 'mirrored' : ''}/>
    <div className="camera-shade"/>
    <div className="camera-topbar">
      <button type="button" onClick={close} aria-label="Close camera">✕</button>
      <div><b>PUMP VISION</b><span><i/> LIVE DOCUMENT SCAN</span></div>
      <button type="button" className={torch ? 'active' : ''} disabled={!torchSupported} onClick={toggleTorch} aria-label="Toggle torch">ϟ</button>
    </div>
    <div className="camera-guide">
      <i/><i/><i/><i/>
      <div className="camera-scanline"/>
      <div className="guide-copy"><b>Receipt को frame के अंदर रखें</b><span>पूरी slip · सीधी · साफ रोशनी</span></div>
    </div>
    {error && <div className="camera-error">{error}<button type="button" onClick={close}>Gallery पर वापस जाएँ</button></div>}
    <div className="camera-bottom">
      <button type="button" className="camera-tool" onClick={flip}><span>↻</span><small>Flip</small></button>
      <button type="button" className={`camera-shutter ${capturing ? 'capturing' : ''}`} disabled={!ready || capturing} onClick={capture}><i/></button>
      <div className="camera-tool camera-quality"><span>HD</span><small>{ready ? 'Ready' : 'Starting'}</small></div>
    </div>
    {capturing && <div className="camera-flash"/>}
  </div>
}
