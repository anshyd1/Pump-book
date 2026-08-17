import { createWorker, PSM } from 'tesseract.js'

export type ReadingSlot = 'morning' | 'evening'
export type ScanResult = { readings: string[]; dayVolumes: string[]; confidence: number; rawText: string; slipTime: string; suggestedSlot: ReadingSlot | null }

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
  const fixed = value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/[%]/g, '8').replace(/[Gg](?=\d)/g, '4').replace(/,/g, '.').replace(/[ \t]+/g, '')
  return Array.from(fixed.matchAll(/(\d{4,9})\.(\d{3})/g))
    .map(match => `${match[1]}.${match[2]}`)
    .filter(result => Number(result) >= 10_000 && Number(result) < 10_000_000)
}
const numberFrom = (value: string): string => candidateNumbers(value)[0] ?? ''
const largestNumberFrom = (value: string): string => candidateNumbers(value).sort((a, b) => Number(b) - Number(a))[0] ?? ''
// All current meters print six or more integer digits. Never hard-code a pump's magnitude:
// different Pump S.No. machines can have completely different cumulative ranges.
const validForNozzle = (value: string, _index: number) => {
  if (!value) return ''
  return value.split('.')[0].length >= 6 && Number(value) >= 10_000 && Number(value) < 10_000_000 ? value : ''
}

const loadImage = (file: File): Promise<LoadedImage> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight, image }) }
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
  image.src = url
})

const imageCanvas = ({ image, width, height }: LoadedImage): HTMLCanvasElement => {
  const scale = Math.min(2.5, 3000 / Math.max(width, height))
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
  const cropW = Math.max(1, ex - sx), cropH = Math.max(1, ey - sy), scale = Math.min(2.5, 3000 / Math.max(cropW, cropH))
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

const adaptiveLineCrop = (image: HTMLCanvasElement, index: number): HTMLCanvasElement => {
  const top = Math.max(0, Math.round(image.height * (LINE_TOP_RATIOS[index] - .012)))
  const cropH = Math.min(image.height - top, Math.max(55, Math.round(image.height * .045)))
  const scale = Math.min(2.4, 2200 / image.width)
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(cropH * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, top, image.width, cropH, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height), w = canvas.width, h = canvas.height
  const gray = new Uint8Array(w * h), integral = new Uint32Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y += 1) {
    let row = 0
    for (let x = 0; x < w; x += 1) {
      const at = y * w + x, p = at * 4
      gray[at] = Math.round(pixels.data[p] * .299 + pixels.data[p + 1] * .587 + pixels.data[p + 2] * .114)
      row += gray[at]; integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row
    }
  }
  const radius = Math.max(10, Math.round(w / 65))
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const x0 = Math.max(0, x - radius), y0 = Math.max(0, y - radius), x1 = Math.min(w - 1, x + radius), y1 = Math.min(h - 1, y + radius)
    const area = (x1 - x0 + 1) * (y1 - y0 + 1)
    const sum = integral[(y1 + 1) * (w + 1) + x1 + 1] - integral[y0 * (w + 1) + x1 + 1] - integral[(y1 + 1) * (w + 1) + x0] + integral[y0 * (w + 1) + x0]
    const value = gray[y * w + x] < sum / area - 9 ? 0 : 255, p = (y * w + x) * 4
    pixels.data[p] = value; pixels.data[p + 1] = value; pixels.data[p + 2] = value
  }
  context.putImageData(pixels, 0, 0); return canvas
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

const markerRegex = /[n0o]\s*[o0]?\s*[z2]\s*[z2]\s*l\s*e\s*n\s*[o0]\s*([0-9oOIl|zZsS?/dD])/gi
const labelRegex = /[cs]?\s*[uoy]\s*m\s*v\s*[o0]\s*l?\s*[uoy]\s*m\s*[eoc]?\s*:?/gi

const markerNumber = (char: string) => Number(char.replace(/[oO]/g, '0').replace(/[Il|]/g, '1').replace(/[zZ?/]/g, '2').replace(/[dD]/g, '4').replace(/[sS]/g, '5'))
const cumVolumeFromSection = (text: string) => {
  for (const label of text.matchAll(labelRegex)) {
    const value = numberFrom(text.slice(label.index! + label[0].length, label.index! + label[0].length + 100))
    if (value) return value
  }
  return ''
}
const cropBelowCumVolume = (section: HTMLCanvasElement, tsv: string | null): HTMLCanvasElement | null => {
  if (!tsv) return null
  const words = tsv.split('\n').slice(1).map(line => line.split('\t')).filter(columns => columns.length >= 12)
  const label = words.find(columns => {
    const word = columns.slice(11).join(' ').toLowerCase().replace(/[^a-z]/g, '')
    return /cumv|sumv|umv|volume/.test(word)
  })
  if (!label) return null
  const top = Number(label[7]), wordHeight = Number(label[10])
  if (!Number.isFinite(top) || !Number.isFinite(wordHeight)) return null
  const sy = Math.max(0, Math.round(top + wordHeight * .9)), sh = Math.min(section.height - sy, Math.max(48, Math.round(wordHeight * 1.85)))
  const canvas = document.createElement('canvas'), scale = Math.min(2.5, 2400 / section.width)
  canvas.width = Math.round(section.width * scale); canvas.height = Math.round(sh * scale)
  canvas.getContext('2d')!.drawImage(section, 0, sy, section.width, sh, 0, 0, canvas.width, canvas.height)
  return canvas
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

const dayVolumeFromSection = (section: string) => {
  const lines = section.replace(/\r/g, '').split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = lines[index].toLowerCase().replace(/[^a-z0-9.,]/g, '')
    if (!/(?:day|bay|pay)v/.test(normalized)) continue
    const sample = `${lines[index]} ${lines[index + 1] ?? ''}`.replace(/[Oo]/g, '0').replace(/,/g, '.')
    const match = sample.match(/(\d+)\s*\.\s*(\d{3})/)
    if (match) return `${match[1]}.${match[2]}`
  }
  return ''
}
const detectSlipSlot = (text: string): ReadingSlot | null => {
  const match = text.match(/(?:time|t[il1]me)\s*[:\-]?\s*([0-2]?\d)\s*[:.]\s*([0-5]\d)/i)
  if (!match) return null
  const hour = Number(match[1]); return hour < 12 ? 'morning' : 'evening'
}
export function parseDayVolumes(raw: string): string[] {
  const text = raw.replace(/\r/g, ''), markers = Array.from(text.matchAll(markerRegex)).map(match => ({ nozzle: markerNumber(match[1]), index: match.index! })).filter(item => item.nozzle >= 1 && item.nozzle <= 4)
  const result = ['', '', '', '']
  const firstTwo = markers.find(item => item.nozzle === 2)
  if (firstTwo) result[0] = dayVolumeFromSection(text.slice(0, firstTwo.index))
  markers.forEach((marker, index) => { result[marker.nozzle - 1] = dayVolumeFromSection(text.slice(marker.index, markers[index + 1]?.index ?? text.length)) })
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
  const readings = ['', '', '', ''], dayVolumes = ['', '', '', ''], texts: string[] = []
  const filenameTime = file.name.match(/\d{8}(\d{2})\d{4}/)
  let suggestedSlot: ReadingSlot | null = filenameTime ? (Number(filenameTime[1]) < 12 ? 'morning' : 'evening') : null
  const hasTime = () => performance.now() < deadline

  try {
    // Layout-independent first pass: firmware versions place CumVolume at different heights.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, tessedit_char_whitelist: '', preserve_interword_spaces: '1', user_defined_dpi: '300' })
    const full = await worker.recognize(normalized)
    texts.push(`Full receipt:\n${full.data.text}`); stage += 1
    suggestedSlot = detectSlipSlot(full.data.text) ?? suggestedSlot
    parseDocumentText(full.data.text).forEach((value, index) => { const verified = validForNozzle(value, index); if (verified) readings[index] = verified })
    parseDayVolumes(full.data.text).forEach((value, index) => { if (value) dayVolumes[index] = value })

    // OCR each missing nozzle block separately; this preserves tiny decimals and the torn T4 edge.
    if (readings.some(value => !value) && hasTime()) {
      const ranges = [[.13, .42], [.38, .64], [.60, .84], [.79, 1]]
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '', preserve_interword_spaces: '1' })
      for (let index = 0; index < 4 && hasTime(); index += 1) {
        if (readings[index]) continue
        const [from, to] = ranges[index], top = Math.round(normalized.height * from), bottomY = Math.round(normalized.height * to)
        const section = document.createElement('canvas'); section.width = normalized.width; section.height = bottomY - top
        section.getContext('2d')!.drawImage(normalized, 0, top, normalized.width, section.height, 0, 0, section.width, section.height)
        const { data } = await worker.recognize(section, {}, { text: true, tsv: true })
        let verified = validForNozzle(cumVolumeFromSection(data.text), index)
        const valueStrip = cropBelowCumVolume(section, data.tsv)
        if (!verified && valueStrip && hasTime()) {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' })
          const precise = await worker.recognize(valueStrip)
          verified = validForNozzle(numberFrom(precise.data.text), index)
          texts.push(`Section precise T${index + 1}: ${precise.data.text}`)
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '', preserve_interword_spaces: '1' })
        }
        if (verified) readings[index] = verified
        const sectionDayVolume = dayVolumeFromSection(data.text); if (sectionDayVolume) dayVolumes[index] = sectionDayVolume
        texts.push(`Section T${index + 1}: ${data.text}`); stage += 1
      }
    }

    // Fast coordinate fallback only for fields the document parser missed.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,', user_defined_dpi: '300' })
    for (let index = 0; index < 4; index += 1) {
      if (readings[index]) continue
      const top = Math.min(height - 1, Math.max(0, Math.round(height * LINE_TOP_RATIOS[index])))
      const { data } = await worker.recognize(source, { rectangle: {
        left: Math.round(width * .30), top, width: Math.round(width * .55),
        height: Math.max(50, Math.min(height - top, Math.round(height * .020)))
      } })
      readings[index] = validForNozzle(numberFrom(data.text), index)
      texts.push(`Fast T${index + 1}: ${data.text}`); stage += 1
    }

    // Newer shift-report firmware prints longer nozzle blocks; try its calibrated line positions only for missing fields.
    const longLayoutRatios = [.37, .568, .758, .958]
    if (readings.some(value => !value) && hasTime()) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' })
      for (let index = 0; index < 4; index += 1) {
        if (readings[index]) continue
        const top = Math.min(height - 1, Math.round(height * longLayoutRatios[index]))
        const { data } = await worker.recognize(source, { rectangle: {
          left: Math.round(width * .18), top, width: Math.round(width * .68),
          height: Math.max(55, Math.min(height - top, Math.round(height * .026)))
        } })
        readings[index] = validForNozzle(numberFrom(data.text), index)
        texts.push(`Long-layout T${index + 1}: ${data.text}`); stage += 1
      }
    }

    // Faded T1 gets binary verification only when both layout passes missed it.
    if (!readings[0] && hasTime()) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '0123456789.,' })
      const primary = await worker.recognize(thresholdCrop(source, width, height, 130))
      const primaryValue = validForNozzle(largestNumberFrom(primary.data.text), 0)
      texts.push(`T1 verify: ${primary.data.text}`); stage += 1
      if (primaryValue) readings[0] = primaryValue
    }

    // Faded T1 gets at most two extra binary thresholds, only when the primary verification failed.
    if (!readings[0] && hasTime()) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '0123456789.,' })
      for (const threshold of [110, 155]) {
        const { data } = await worker.recognize(thresholdCrop(source, width, height, threshold))
        const verified = validForNozzle(largestNumberFrom(data.text), 0)
        texts.push(`T1 retry ${threshold}: ${data.text}`); stage += 1
        if (verified) { readings[0] = verified; break }
        if (!hasTime()) break
      }
    }

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

    // T4 sits at the torn bottom edge; OCR that final receipt section at full crop resolution.
    if (!readings[3] && hasTime()) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '', preserve_interword_spaces: '1' })
      const bottom = document.createElement('canvas'), top = Math.round(normalized.height * .80)
      bottom.width = normalized.width; bottom.height = normalized.height - top
      bottom.getContext('2d')!.drawImage(normalized, 0, top, normalized.width, bottom.height, 0, 0, bottom.width, bottom.height)
      const { data } = await worker.recognize(bottom)
      const verified = validForNozzle(cumVolumeFromSection(data.text), 3)
      if (verified) readings[3] = verified
      texts.push(`Bottom T4 section: ${data.text}`); stage += 1
    }

    // Low-camera-quality pass: adaptive local threshold handles shadows and faded thermal text.
    if (readings.some(value => !value) && hasTime()) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' })
      for (let index = 0; index < 4 && hasTime(); index += 1) {
        if (readings[index]) continue
        const { data } = await worker.recognize(adaptiveLineCrop(normalized, index))
        const verified = validForNozzle(numberFrom(data.text), index)
        if (verified) readings[index] = verified
        texts.push(`Adaptive T${index + 1}: ${data.text}`); stage += 1
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
    return { readings, dayVolumes, confidence: readings.filter(Boolean).length * 25, rawText: texts.join('\n'), slipTime: '', suggestedSlot }
  } finally { workerLogger = null; releaseOcrWorkerLater() }
}
