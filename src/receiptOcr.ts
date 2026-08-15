import { createWorker, PSM } from 'tesseract.js'

export type ScanResult = {
  readings: string[]
  confidence: number
  rawText: string
}

const cleanNumber = (value: string): string => {
  const fixed = value
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/[^0-9.]/g, '')
  const parts = fixed.split('.').filter(Boolean)
  if (parts.length < 2) return ''
  const decimal = parts.pop()!
  const integer = parts.join('')
  if (!integer || decimal.length !== 3) return ''
  return `${integer}.${decimal}`
}

// IndianOil slips list one section per nozzle and print CumVolume near its end.
// OCR often inserts spaces ("CumVo lume") or confuses O/0, I/1 and comma/dot.
export function parseCumVolumes(rawText: string): string[] {
  const text = rawText.replace(/\r/g, '')
  const markers: { nozzle: number; index: number }[] = []
  const markerRe = /no\s*[z2]\s*[z2]\s*l\s*e\s*n\s*[o0]\s*([0-9oOIl|zZsS])/gi
  for (const match of text.matchAll(markerRe)) {
    const digit = match[1].replace(/[oO]/g, '0').replace(/[Il|]/g, '1').replace(/[zZ]/g, '2').replace(/[sS]/g, '5')
    const nozzle = Number(digit)
    if (nozzle >= 1 && nozzle <= 4) markers.push({ nozzle, index: match.index! })
  }

  const sections = new Map<number, string>()
  if (markers.length) {
    // If OCR missed the Nozzle 1 heading, everything before Nozzle 2 is still its section.
    const firstTwo = markers.find(m => m.nozzle === 2)
    if (!markers.some(m => m.nozzle === 1) && firstTwo) sections.set(1, text.slice(0, firstTwo.index))
    markers.forEach((m, i) => sections.set(m.nozzle, text.slice(m.index, markers[i + 1]?.index ?? text.length)))
  } else {
    sections.set(1, text)
  }

  return [1, 2, 3, 4].map(nozzle => {
    const section = sections.get(nozzle) ?? ''
    // Prefer a decimal value within 45 characters after a fuzzy CumVolume label.
    const label = /c\s*[uoy]\s*m\s*v\s*[o0]\s*l\s*[uoy]\s*m\s*[eoc]?\s*:?/ig
    for (const match of section.matchAll(label)) {
      const tail = section.slice(match.index! + match[0].length, match.index! + match[0].length + 55)
      // कम से कम 3 लगातार integer digits माँगें, ताकि OCR का stray "8" अगली line में न जुड़ जाए।
      const candidates = tail.match(/[0-9OoIl|]{3,}[0-9OoIl|\s]*[.,]\s*[0-9OoIl|](?:\s*[0-9OoIl|]){2}/g) ?? []
      for (const candidate of candidates) {
        const cleaned = cleanNumber(candidate)
        if (cleaned && Number(cleaned) > 100) return cleaned
      }
    }
    return ''
  })
}

export async function scanReceipt(file: File, onProgress: (progress: number, status: string) => void): Promise<ScanResult> {
  const worker = await createWorker('eng', 1, {
    logger: message => onProgress(message.progress || 0, message.status)
  })
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    })
    const { data } = await worker.recognize(file, { rotateAuto: true })
    return {
      readings: parseCumVolumes(data.text),
      confidence: Math.round(data.confidence),
      rawText: data.text
    }
  } finally {
    await worker.terminate()
  }
}
