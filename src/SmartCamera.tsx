import { useEffect, useRef, useState } from 'react'

type Props = { open: boolean; onClose: () => void; onCapture: (file: File) => void }

type TorchTrack = MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean } }
const assessCapture = (source: HTMLCanvasElement) => {
  const canvas = document.createElement('canvas'), width = 240, height = Math.max(120, Math.round(source.height * width / source.width))
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(source, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height).data, gray = new Uint8Array(width * height)
  let light = 0, glare = 0
  for (let i = 0; i < gray.length; i += 1) { const p = i * 4; gray[i] = Math.round(data[p] * .299 + data[p + 1] * .587 + data[p + 2] * .114); light += gray[i]; if (gray[i] > 248) glare += 1 }
  let edges = 0
  for (let y = 1; y < height; y += 1) for (let x = 1; x < width; x += 1) { const at = y * width + x; edges += Math.abs(gray[at] - gray[at - 1]) + Math.abs(gray[at] - gray[at - width]) }
  const brightness = light / gray.length, sharpness = edges / ((width - 1) * (height - 1) * 2), glareRatio = glare / gray.length
  if (brightness < 48) return 'Photo बहुत dark है—torch या ज्यादा light इस्तेमाल करें।'
  if (sharpness < 5.2) return 'Photo blur है—phone steady रखकर focus होने के बाद capture करें।'
  if (glareRatio > .42) return 'Paper पर glare ज्यादा है—camera का angle थोड़ा बदलें।'
  return ''
}

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
  const [qualityWarning, setQualityWarning] = useState('')
  const [pendingCapture, setPendingCapture] = useState<File | null>(null)

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
      stop(); setReady(false); setError(''); setTorch(false); setQualityWarning(''); setPendingCapture(null)
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
    const previewAspect = video.videoWidth / video.videoHeight, boxAspect = videoBox.width / videoBox.height
    let shownWidth = videoBox.width, shownHeight = videoBox.height, offsetX = 0, offsetY = 0
    if (previewAspect > boxAspect) { shownHeight = shownWidth / previewAspect; offsetY = (videoBox.height - shownHeight) / 2 }
    else { shownWidth = shownHeight * previewAspect; offsetX = (videoBox.width - shownWidth) / 2 }
    const gx = guide ? guide.left - videoBox.left - offsetX : 0, gy = guide ? guide.top - videoBox.top - offsetY : 0
    const gw = guide?.width ?? shownWidth, gh = guide?.height ?? shownHeight, padX = gw * .04, padY = gh * .025
    const nx = Math.max(0, (gx - padX) / shownWidth), ny = Math.max(0, (gy - padY) / shownHeight)
    const nw = Math.min(1 - nx, (gw + padX * 2) / shownWidth), nh = Math.min(1 - ny, (gh + padY * 2) / shownHeight)

    let captureSource: CanvasImageSource = video, captureWidth = video.videoWidth, captureHeight = video.videoHeight
    let bitmap: ImageBitmap | null = null
    const track = streamRef.current?.getVideoTracks()[0]
    const ImageCaptureApi = (window as unknown as { ImageCapture?: new (track: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture
    if (track && ImageCaptureApi && 'createImageBitmap' in window) {
      try {
        const photo = await new ImageCaptureApi(track).takePhoto()
        bitmap = await createImageBitmap(photo); captureSource = bitmap; captureWidth = bitmap.width; captureHeight = bitmap.height
      } catch { /* video-frame fallback below */ }
    }
    const photoAspect = captureWidth / captureHeight
    let baseX = 0, baseY = 0, effectiveWidth = captureWidth, effectiveHeight = captureHeight
    if (photoAspect > previewAspect) { effectiveWidth = captureHeight * previewAspect; baseX = (captureWidth - effectiveWidth) / 2 }
    else if (photoAspect < previewAspect) { effectiveHeight = captureWidth / previewAspect; baseY = (captureHeight - effectiveHeight) / 2 }
    const sx = baseX + nx * effectiveWidth, sy = baseY + ny * effectiveHeight
    const sw = Math.min(effectiveWidth - nx * effectiveWidth, nw * effectiveWidth), sh = Math.min(effectiveHeight - ny * effectiveHeight, nh * effectiveHeight)
    canvas.width = Math.max(1, Math.round(sw)); canvas.height = Math.max(1, Math.round(sh))
    const context = canvas.getContext('2d')!
    if (facing === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1) }
    context.drawImage(captureSource, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    bitmap?.close()
    const warning = assessCapture(canvas)
    canvas.toBlob(blob => {
      setCapturing(false)
      if (!blob) return
      const file = new File([blob], `pump-slip-${Date.now()}.jpg`, { type: 'image/jpeg' })
      if (warning) { setPendingCapture(file); setQualityWarning(warning); return }
      stop(); onClose(); onCapture(file)
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
    {qualityWarning && pendingCapture && <div className="camera-quality-warning"><b>Photo quality check</b><p>{qualityWarning}</p><div><button type="button" onClick={() => { setQualityWarning(''); setPendingCapture(null) }}>↻ Retake</button><button type="button" onClick={() => { const file = pendingCapture; stop(); setQualityWarning(''); setPendingCapture(null); onClose(); onCapture(file) }}>Use anyway</button></div></div>}
    <div className="camera-bottom">
      <button type="button" className="camera-tool" onClick={flip}><span>↻</span><small>Flip</small></button>
      <button type="button" className={`camera-shutter ${capturing ? 'capturing' : ''}`} disabled={!ready || capturing || Boolean(qualityWarning)} onClick={capture}><i/></button>
      <div className="camera-tool camera-quality"><span>HD</span><small>{ready ? 'Ready' : 'Starting'}</small></div>
    </div>
    {capturing && <div className="camera-flash"/>}
  </div>
}
