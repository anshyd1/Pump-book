import { createWorker, PSM } from 'tesseract.js'

export type ReadingSlot = 'morning' | 'evening'
export type ScanResult = { readings: string[]; confidence: number; rawText: string; slipTime: string; suggestedSlot: ReadingSlot | null }

type LoadedImage = { width: number; height: number; image: HTMLImageElement }
type OcrWorker = Awaited<ReturnType<typeof createWorker>>
let workerPromise: Promise<OcrWorker> | null = null
let workerLogger: ((progress: number, status: string) => void) | null = null
let workerIdleTimer: number | undefined
const getOcrWorker = () => {
  if (workerIdleTimer) window.clearTimeout(workerIdleTimer)
  if (!workerPromise) workerPromise = createWorker('eng', 1, { logger: message => workerLogger?.(message.progress || 0, message.status) })
  return workerPromise
}
const releaseOcrWorkerLater = () => {
  if (workerIdleTimer) window.clearTimeout(workerIdleTimer)
  workerIdleTimer = window.setTimeout(() => {
    const current = workerPromise; workerPromise = null; workerLogger = null
    void current?.then(worker => worker.terminate()).catch(() => undefined)
  }, 120_000)
}

const candidateNumbers = (value: string): string[] => {
  // Horizontal OCR gaps हटाएँ, लेकिन lines को कभी concatenate न करें—वरना दो अलग numbers मिलकर fake decimal बनाते हैं।
  const fixed = value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/,/g, '.').replace(/[ \t]+/g, '')
  return Array.from(fixed.matchAll(/(\d{4,9})\.(\d{3})/g))
    .map(match => `${match[1]}.${match[2]}`)
    .filter(result => Number(result) >= 10_000 && Number(result) < 10_000_000)
}
const numberFrom = (value: string): string => candidateNumbers(value)[0] ?? ''
const largestNumberFrom = (value: string): string => candidateNumbers(value).sort((a, b) => Number(b) - Number(a))[0] ?? ''
// This four-nozzle installation already has six/seven-digit cumulative meters.
// Reject shortened OCR fragments (for example 42170.070 or a CumSale tail).
const validForNozzle = (value: string, index: number) => {
  if (!value) return ''
  const minimumIntegerDigits = [6, 7, 6, 7][index]
  const pumpSafeMinimum = [500_000, 1_000_000, 100_000, 3_000_000][index]
  return value.split('.')[0].length >= minimumIntegerDigits && Number(value) >= pumpSafeMinimum ? value : ''
}

const loadImage = (file: File): Promise<LoadedImage> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight, image }) }
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
  image.src = url
})

const imageCanvas = ({ image, width, height }: LoadedImage): HTMLCanvasElement => {
  const scale = Math.min(1, 3000 / Math.max(width, height))
  const canvas = document.createElement('canvas'); canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

const normalizeReceipt = ({ image, width, height }: LoadedImage): HTMLCanvasElement => {
  // Detect the tall, low-saturation thermal-paper component around the photo centre.
  const sampleW = Math.min(360, width), sampleH = Math.round(height * sampleW / width)
  const sample = document.createElement('canvas'); sample.width = sampleW; sample.height = sampleH
  const sampleContext = sample.getContext('2d', { willReadFrequently: true })!
  sampleContext.drawImage(image, 0, 0, sampleW, sampleH)
  const data = sampleContext.getImageData(0, 0, sampleW, sampleH).data
  const mask = new Uint8Array(sampleW * sampleH)
  for (let i = 0; i < mask.length; i += 1) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b), lum = r * .299 + g * .587 + b * .114
    if (lum > 125 && max - min < 62) mask[i] = 1
  }
  const seen = new Uint8Array(mask.length)
  let best: { left: number; top: number; right: number; bottom: number; count: number; score: number } | null = null
  const queue = new Int32Array(mask.length)
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue
    let head = 0, tail = 0, left = sampleW, right = 0, top = sampleH, bottom = 0, count = 0
    queue[tail++] = start; seen[start] = 1
    while (head < tail) {
      const at = queue[head++], x = at % sampleW, y = Math.floor(at / sampleW)
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); count += 1
      const neighbours = [at - 1, at + 1, at - sampleW, at + sampleW]
      for (const next of neighbours) {
        if (next < 0 || next >= mask.length || seen[next] || !mask[next]) continue
        const nx = next % sampleW
        if (Math.abs(nx - x) > 1) continue
        seen[next] = 1; queue[tail++] = next
      }
    }
    const boxW = right - left + 1, boxH = bottom - top + 1, centre = (left + right) / 2
    if (boxH < sampleH * .38 || boxW > sampleW * .78 || count < mask.length * .012) continue
    const score = boxH * 4 + count / 20 - Math.abs(centre - sampleW / 2) * 1.5 - Math.max(0, boxW / boxH - .58) * 300
    if (!best || score > best.score) best = { left, top, right, bottom, count, score }
  }
  const ratioX = width / sampleW, ratioY = height / sampleH
  const fallback = { left: 0, top: 0, right: sampleW - 1, bottom: sampleH - 1 }
  const box = best ?? fallback
  const padX = Math.round((box.right - box.left) * .22), padY = Math.round((box.bottom - box.top) * .015)
  const sx = Math.max(0, Math.round((box.left - padX) * ratioX)), sy = Math.max(0, Math.round((box.top - padY) * ratioY))
  const ex = Math.min(width, Math.round((box.right + padX) * ratioX)), ey = Math.min(height, Math.round((box.bottom + padY) * ratioY))
  const cropW = Math.max(1, ex - sx), cropH = Math.max(1, ey - sy), scale = Math.min(1, 3000 / Math.max(cropW, cropH))
  const canvas = document.createElement('canvas'); canvas.width = Math.round(cropW * scale); canvas.height = Math.round(cropH * scale)
  canvas.getContext('2d')!.drawImage(image, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height)
  return canvas
}

const thresholdCrop = (image: CanvasImageSource, width: number, height: number, threshold = 130): HTMLCanvasElement => {
  const sx = Math.round(width * 0.325), sy = Math.round(height * 0.266)
  const sw = Math.round(width * 0.39), sh = Math.round(height * 0.035)
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(2600, sw * 2); canvas.height = Math.round(sh * (canvas.width / sw))
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const lum = pixels.data[i] * .299 + pixels.data[i + 1] * .587 + pixels.data[i + 2] * .114
    const v = lum > threshold ? 255 : 0
    pixels.data[i] = v; pixels.data[i + 1] = v; pixels.data[i + 2] = v
  }
  context.putImageData(pixels, 0, 0)
  return canvas
}

const thermalSectionCrop = (image: HTMLCanvasElement, index: number, threshold: number): HTMLCanvasElement => {
  const topRatio = Math.max(0, LINE_TOP_RATIOS[index] - .045), heightRatio = index === 3 ? .075 : .09
  const sy = Math.round(image.height * topRatio), sh = Math.min(image.height - sy, Math.round(image.height * heightRatio))
  const scale = Math.min(2.2, 2400 / image.width)
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(sh * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, sy, image.width, sh, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const lum = pixels.data[i] * .299 + pixels.data[i + 1] * .587 + pixels.data[i + 2] * .114
    const value = lum > threshold ? 255 : 0
    pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value
  }
  context.putImageData(pixels, 0, 0); return canvas
}

const rotateSameSize = (image: HTMLCanvasElement, angle: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
  const context = canvas.getContext('2d')!; context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2); context.rotate(angle * Math.PI / 180)
  context.drawImage(image, -image.width / 2, -image.height / 2); return canvas
}

const documentCanvas = (image: HTMLCanvasElement, angle = 0): HTMLCanvasElement => {
  const width = image.width, height = image.height
  const scale = Math.min(1, 1800 / Math.max(width, height))
  const w = Math.round(width * scale), h = Math.round(height * scale)
  const radians = angle * Math.PI / 180
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians)))
  canvas.height = Math.ceil(Math.abs(h * Math.cos(radians)) + Math.abs(w * Math.sin(radians)))
  const context = canvas.getContext('2d')!
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2); context.rotate(radians)
  context.filter = 'grayscale(1) contrast(1.35)'
  context.drawImage(image, -w / 2, -h / 2, w, h)
  return canvas
}

const markerRegex = /[n0o]\s*[o0]?\s*[z2]\s*[z2]\s*l\s*e\s*n\s*[o0]\s*([0-9oOIl|zZsS])/gi
const labelRegex = /[cs]\s*[uoy]\s*m\s*v\s*[o0]\s*l\s*[uoy]\s*m\s*[eoc]?\s*:?/gi

const markerNumber = (char: string) => Number(char.replace(/[oO]/g, '0').replace(/[Il|]/g, '1').replace(/[zZ]/g, '2').replace(/[sS]/g, '5'))
const cumVolumeFromSection = (text: string) => {
  for (const label of text.matchAll(labelRegex)) {
    const value = numberFrom(text.slice(label.index! + label[0].length, label.index! + label[0].length + 100))
    if (value) return value
  }
  return ''
}

export function parseDocumentText(raw: string): string[] {
  const text = raw.replace(/\r/g, '')
  const markers = Array.from(text.matchAll(markerRegex)).map(match => ({ nozzle: markerNumber(match[1]), index: match.index! })).filter(item => item.nozzle >= 1 && item.nozzle <= 4)
  const result = ['', '', '', '']

  if (markers.length) {
    const firstTwo = markers.find(item => item.nozzle === 2)
    if (!markers.some(item => item.nozzle === 1) && firstTwo) {
      const firstSection = text.slice(0, firstTwo.index)
      result[0] = validForNozzle(cumVolumeFromSection(firstSection) || largestNumberFrom(firstSection), 0)
    }
    markers.forEach((marker, index) => {
      const section = text.slice(marker.index, markers[index + 1]?.index ?? text.length)
      for (const label of section.matchAll(labelRegex)) {
        const tail = section.slice(label.index! + label[0].length, label.index! + label[0].length + 100)
        const value = numberFrom(tail)
        if (value) { result[marker.nozzle - 1] = value; break }
      }
    })
  }

  // Zoom/crop में nozzle heading कट सकती है; visible CumVolume labels को order में use करें।
  const ordered: string[] = []
  for (const label of text.matchAll(labelRegex)) {
    const value = numberFrom(text.slice(label.index! + label[0].length, label.index! + label[0].length + 100))
    if (value) ordered.push(value)
  }
  if (!markers.length && ordered.length) ordered.slice(0, 4).forEach((value, index) => { result[index] = value })
  return result
}

const LINE_TOP_RATIOS = [0.2734, 0.4785, 0.7080, 0.9717]

export async function scanReceipt(file: File, onProgress: (progress: number, status: string) => void): Promise<ScanResult> {
  const started = performance.now(), deadline = started + 12_000
  const loaded = await loadImage(file)
  onProgress(.03, 'detecting receipt')
  const source = imageCanvas(loaded), normalized = normalizeReceipt(loaded)
  const width = source.width, height = source.height
  let stage = 0
  workerLogger = (progress, status) => {
    if (status === 'recognizing text') onProgress(Math.min(.94, .08 + stage * .15 + progress * .12), 'recognizing text')
    else onProgress(.04, status)
  }
  const worker = await getOcrWorker()
  const readings = ['', '', '', ''], texts: string[] = []
  const hasTime = () => performance.now() < deadline

  try {
    // Fast path: five small OCR jobs. A clean, straight slip finishes here.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,', user_defined_dpi: '300' })
    for (let index = 0; index < 4; index += 1) {
      const top = Math.min(height - 1, Math.max(0, Math.round(height * LINE_TOP_RATIOS[index])))
      const { data } = await worker.recognize(source, { rectangle: {
        left: Math.round(width * .30), top, width: Math.round(width * .55),
        height: Math.max(50, Math.min(height - top, Math.round(height * .020)))
      } })
      readings[index] = validForNozzle(numberFrom(data.text), index)
      texts.push(`Fast T${index + 1}: ${data.text}`); stage += 1
    }

    // T1 is always verified once because its thermal line is faint on this pump.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '0123456789.,' })
    const t1 = await worker.recognize(thresholdCrop(source, width, height, 130))
    const verifiedT1 = validForNozzle(largestNumberFrom(t1.data.text), 0)
    if (verifiedT1) readings[0] = verifiedT1
    texts.push(`T1 verify: ${t1.data.text}`); stage += 1

    // One auto-cropped coordinate pass only for fields still missing.
    if (readings.some(value => !value) && hasTime()) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' })
      for (let index = 0; index < 4 && hasTime(); index += 1) {
        if (readings[index]) continue
        const top = Math.min(normalized.height - 1, Math.max(0, Math.round(normalized.height * LINE_TOP_RATIOS[index])))
        const { data } = await worker.recognize(normalized, { rectangle: {
          left: Math.round(normalized.width * .08), top, width: Math.round(normalized.width * .84),
          height: Math.max(48, Math.min(normalized.height - top, Math.round(normalized.height * .03)))
        } })
        readings[index] = validForNozzle(numberFrom(data.text), index)
        texts.push(`Crop T${index + 1}: ${data.text}`); stage += 1
      }
    }

    // One label-aware document pass; no long angle/threshold loops.
    if (readings.some(value => !value) && hasTime()) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: '', preserve_interword_spaces: '1' })
      const { data } = await worker.recognize(documentCanvas(normalized, 0), { rotateAuto: true })
      texts.push(`Document fallback:\n${data.text}`)
      parseDocumentText(data.text).forEach((value, index) => {
        const verified = validForNozzle(value, index)
        if (!readings[index] && verified && !readings.some((current, other) => other !== index && current === verified)) readings[index] = verified
      })
    }

    onProgress(1, 'recognizing text')
    return { readings, confidence: readings.filter(Boolean).length * 25, rawText: texts.join('\n'), slipTime: '', suggestedSlot: null }
  } finally { workerLogger = null; releaseOcrWorkerLater() }
}
