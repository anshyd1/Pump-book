import { useEffect, useRef, useState } from 'react'

type Props = { open: boolean; onClose: () => void; onCapture: (file: File) => void }

type TorchTrack = MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean } }

export default function SmartCamera({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
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
          video: { facingMode: { ideal: facing } }
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
    const guide = guideRef.current?.getBoundingClientRect(), videoBox = video.getBoundingClientRect()
    const sourceAspect = video.videoWidth / video.videoHeight, boxAspect = videoBox.width / videoBox.height
    let shownWidth = videoBox.width, shownHeight = videoBox.height, offsetX = 0, offsetY = 0
    if (sourceAspect > boxAspect) { shownHeight = shownWidth / sourceAspect; offsetY = (videoBox.height - shownHeight) / 2 }
    else { shownWidth = shownHeight * sourceAspect; offsetX = (videoBox.width - shownWidth) / 2 }
    const gx = guide ? guide.left - videoBox.left - offsetX : 0
    const gy = guide ? guide.top - videoBox.top - offsetY : 0
    const gw = guide?.width ?? shownWidth, gh = guide?.height ?? shownHeight
    const padX = gw * .04, padY = gh * .025
    const sx = Math.max(0, (gx - padX) / shownWidth * video.videoWidth)
    const sy = Math.max(0, (gy - padY) / shownHeight * video.videoHeight)
    const sw = Math.min(video.videoWidth - sx, (gw + padX * 2) / shownWidth * video.videoWidth)
    const sh = Math.min(video.videoHeight - sy, (gh + padY * 2) / shownHeight * video.videoHeight)
    canvas.width = Math.max(1, Math.round(sw)); canvas.height = Math.max(1, Math.round(sh))
    const context = canvas.getContext('2d')!
    if (facing === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1) }
    context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
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
    <div ref={guideRef} className="camera-guide">
      <i/><i/><i/><i/>
      <div className="camera-scanline"/>
      <div className="guide-copy"><b>Receipt को frame के अंदर रखें</b><span>चारों किनारे दिखें · frame में सिर्फ slip रखें</span></div>
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
