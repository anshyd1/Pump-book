import { createWorker, PSM } from 'tesseract.js'

export type ReadingSlot = 'morning' | 'evening'
export type ScanResult = { readings: string[]; confidence: number; rawText: string; slipTime: string; suggestedSlot: ReadingSlot | null }

type LoadedImage = { width: number; height: number; image: HTMLImageElement }

const candidateNumbers = (value: string): string[] => {
  // Horizontal OCR gaps हटाएँ, लेकिन lines को कभी concatenate न करें—वरना दो अलग numbers मिलकर fake decimal बनाते हैं।
  const fixed = value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/,/g, '.').replace(/[ \t]+/g, '')
  return Array.from(fixed.matchAll(/(\d{4,9})\.(\d{3})/g))
    .map(match => `${match[1]}.${match[2]}`)
    .filter(result => Number(result) >= 10_000 && Number(result) < 10_000_000)
}
const numberFrom = (value: string): string => candidateNumbers(value)[0] ?? ''
const largestNumberFrom = (value: string): string => candidateNumbers(value).sort((a, b) => Number(b) - Number(a))[0] ?? ''

const loadImage = (file: File): Promise<LoadedImage> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight, image }) }
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
  image.src = url
})

const thresholdCrop = (image: HTMLImageElement, width: number, height: number, threshold = 130): HTMLCanvasElement => {
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

const documentCanvas = ({ image, width, height }: LoadedImage, angle = 0): HTMLCanvasElement => {
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

const markerRegex = /no\s*[z2]\s*[z2]\s*l\s*e\s*n\s*[o0]\s*([0-9oOIl|zZsS])/gi
const labelRegex = /c\s*[uoy]\s*m\s*v\s*[o0]\s*l\s*[uoy]\s*m\s*[eoc]?\s*:?/gi

const markerNumber = (char: string) => Number(char.replace(/[oO]/g, '0').replace(/[Il|]/g, '1').replace(/[zZ]/g, '2').replace(/[sS]/g, '5'))

export function parseDocumentText(raw: string): string[] {
  const text = raw.replace(/\r/g, '')
  const markers = Array.from(text.matchAll(markerRegex)).map(match => ({ nozzle: markerNumber(match[1]), index: match.index! })).filter(item => item.nozzle >= 1 && item.nozzle <= 4)
  const result = ['', '', '', '']

  if (markers.length) {
    const firstTwo = markers.find(item => item.nozzle === 2)
    if (!markers.some(item => item.nozzle === 1) && firstTwo) markers.unshift({ nozzle: 1, index: 0 })
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
  const loaded = await loadImage(file)
  const { width, height } = loaded
  let completed = 0
  const worker = await createWorker('eng', 1, { logger: message => {
    if (message.status === 'recognizing text') onProgress(Math.min(.96, (completed + message.progress) / 5), 'recognizing text')
    else onProgress(0, message.status)
  } })
  const readings = ['', '', '', ''], texts: string[] = []

  try {
    // Pass 1: fast fixed-layout scan for a full IndianOil slip.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,', user_defined_dpi: '300' })
    for (let index = 0; index < 4; index += 1) {
      const top = Math.min(height - 1, Math.max(0, Math.round(height * LINE_TOP_RATIOS[index])))
      const { data } = await worker.recognize(file, { rectangle: {
        left: Math.round(width * .30), top, width: Math.round(width * .55),
        height: Math.max(50, Math.min(height - top, Math.round(height * .020)))
      } })
      texts[index] = `Fast T${index + 1}: ${data.text}`; readings[index] = numberFrom(data.text)
      completed = index + 1; onProgress(completed / 5, 'recognizing text')
    }

    // Pass 2: T1 हमेशा dedicated high-contrast crop से verify/override हो।
    // Fast line कभी-कभी पास वाली ShMTHVol को valid totalizer समझ लेती है।
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    for (const threshold of [130, 150]) {
      const { data } = await worker.recognize(thresholdCrop(loaded.image, width, height, threshold))
      texts.push(`T1 contrast ${threshold}: ${data.text}`)
      const verifiedT1 = largestNumberFrom(data.text)
      if (verifiedT1) { readings[0] = verifiedT1; break }
    }

    // Pass 3: layout-independent OCR handles zoom, rotation and imperfect framing.
    if (readings.some(value => !value)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: '', preserve_interword_spaces: '1' })
      for (const angle of [0, -3, 3]) {
        const { data } = await worker.recognize(documentCanvas(loaded, angle), { rotateAuto: true })
        texts.push(`Smart document ${angle}°:\n${data.text}`)
        const found = parseDocumentText(data.text)
        found.forEach((value, index) => { if (!readings[index] && value) readings[index] = value })
        if (readings.every(Boolean)) break
      }
    }

    onProgress(1, 'recognizing text')
    return {
      readings,
      confidence: readings.filter(Boolean).length * 25,
      rawText: texts.join('\n'), slipTime: '', suggestedSlot: null
    }
  } finally { await worker.terminate() }
}
