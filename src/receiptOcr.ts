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
  const loaded = await loadImage(file)
  onProgress(.02, 'detecting receipt')
  const source = imageCanvas(loaded)
  const normalized = normalizeReceipt(loaded)
  const width = source.width, height = source.height
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
      const { data } = await worker.recognize(source, { rectangle: {
        left: Math.round(width * .30), top, width: Math.round(width * .55),
        height: Math.max(50, Math.min(height - top, Math.round(height * .020)))
      } })
      texts[index] = `Fast T${index + 1}: ${data.text}`; readings[index] = validForNozzle(numberFrom(data.text), index)
      completed = index + 1; onProgress(completed / 5, 'recognizing text')
    }

    // Pass 2: T1 हमेशा dedicated high-contrast crop से verify/override हो।
    // Fast line कभी-कभी पास वाली ShMTHVol को valid totalizer समझ लेती है।
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    for (const threshold of [130, 150]) {
      const { data } = await worker.recognize(thresholdCrop(source, width, height, threshold))
      texts.push(`T1 contrast ${threshold}: ${data.text}`)
      const verifiedT1 = largestNumberFrom(data.text)
      if (validForNozzle(verifiedT1, 0)) { readings[0] = verifiedT1; break }
    }

    // Pass 3: repeat targeted lines on the automatically detected paper crop.
    if (readings.some(value => !value)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' })
      for (let index = 0; index < 4; index += 1) {
        if (readings[index]) continue
        const top = Math.min(normalized.height - 1, Math.max(0, Math.round(normalized.height * LINE_TOP_RATIOS[index])))
        const { data } = await worker.recognize(normalized, { rectangle: {
          left: Math.round(normalized.width * .12), top, width: Math.round(normalized.width * .76),
          height: Math.max(50, Math.min(normalized.height - top, Math.round(normalized.height * .026)))
        } })
        texts.push(`Auto-crop T${index + 1}: ${data.text}`)
        readings[index] = validForNozzle(numberFrom(data.text), index)
      }
      if (!readings[0]) {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
        for (const threshold of [120, 140, 160]) {
          const { data } = await worker.recognize(thresholdCrop(normalized, normalized.width, normalized.height, threshold))
          const verified = largestNumberFrom(data.text); texts.push(`Auto-crop T1 ${threshold}: ${data.text}`)
          if (validForNozzle(verified, 0)) { readings[0] = verified; break }
        }
      }
    }

    // Thermal section crops use the whole detected paper width, so zoomed uploads do not lose leading digits.
    if (readings.some(value => !value)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '' })
      for (let index = 0; index < 4; index += 1) {
        if (readings[index]) continue
        for (const threshold of [110, 130, 150, 170]) {
          const { data } = await worker.recognize(thermalSectionCrop(normalized, index, threshold))
          texts.push(`Thermal section T${index + 1} ${threshold}: ${data.text}`)
          const verified = validForNozzle(cumVolumeFromSection(data.text), index)
          if (verified) { readings[index] = verified; break }
        }
      }
    }

    // Deskew the detected paper before another label-aware thermal pass.
    if (readings.some(value => !value)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: '' })
      for (const angle of [-6, 6]) {
        const deskewed = rotateSameSize(normalized, angle)
        for (let index = 0; index < 4; index += 1) {
          if (readings[index]) continue
          const { data } = await worker.recognize(thermalSectionCrop(deskewed, index, 130))
          texts.push(`Deskew thermal T${index + 1} ${angle}°: ${data.text}`)
          const verified = validForNozzle(cumVolumeFromSection(data.text), index)
          if (verified) readings[index] = verified
        }
        if (readings.every(Boolean)) break
      }
    }

    // Bottom-edge hunt: T4 sits close to the photo edge, so search several narrow rows after deskew.
    if (!readings[3]) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' })
      for (const angle of [-6, 6, 0]) {
        const deskewed = angle ? rotateSameSize(normalized, angle) : normalized
        for (const ratio of [.92, .935, .95, .965, .98]) {
          const top = Math.min(deskewed.height - 1, Math.round(deskewed.height * ratio))
          const { data } = await worker.recognize(deskewed, { rectangle: { left: 0, top, width: deskewed.width, height: Math.min(deskewed.height - top, Math.max(45, Math.round(deskewed.height * .024))) } })
          texts.push(`T4 edge ${angle}° ${ratio}: ${data.text}`)
          const verified = validForNozzle(numberFrom(data.text), 3)
          if (verified) { readings[3] = verified; break }
        }
        if (readings[3]) break
      }
    }

    // Pass 4: wide-line retries recover zoomed photos and ±6° crooked captures.
    if (readings.some(value => !value)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: '0123456789.,' })
      for (const angle of [0, -6, 6, -3, 3]) {
        const retrySource = angle === 0 ? source : documentCanvas(source, angle)
        for (let index = 0; index < 4; index += 1) {
          if (readings[index]) continue
          const top = Math.max(0, Math.min(retrySource.height - 1, Math.round(retrySource.height * LINE_TOP_RATIOS[index])))
          const { data } = await worker.recognize(retrySource, { rectangle: {
            left: Math.round(retrySource.width * .04), top, width: Math.round(retrySource.width * .92),
            height: Math.max(45, Math.min(retrySource.height - top, Math.round(retrySource.height * .028)))
          } })
          texts.push(`Wide T${index + 1} ${angle}°: ${data.text}`)
          readings[index] = validForNozzle(numberFrom(data.text), index)
        }
        if (readings.every(Boolean)) break
      }
    }

    // Pass 5: layout-independent OCR handles zoom, rotation and imperfect framing.
    if (readings.some(value => !value)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: '', preserve_interword_spaces: '1' })
      for (const [passName, document] of [['auto-crop', normalized], ['full-frame', source]] as const) {
        for (const angle of [0, -3, 3, -6, 6]) {
          const { data } = await worker.recognize(documentCanvas(document, angle), { rotateAuto: true })
          texts.push(`Smart ${passName} ${angle}°:\n${data.text}`)
          const found = parseDocumentText(data.text)
          found.forEach((value, index) => {
            const verified = validForNozzle(value, index)
            const duplicatesAnotherNozzle = readings.some((current, currentIndex) => currentIndex !== index && current === verified)
            if (!readings[index] && verified && !duplicatesAnotherNozzle) readings[index] = verified
          })
          if (readings.every(Boolean)) break
        }
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
