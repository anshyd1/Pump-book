import { createWorker, PSM } from 'tesseract.js'

export type ReadingSlot = 'morning' | 'evening'

export type ScanResult = {
  readings: string[]
  confidence: number
  rawText: string
  slipTime: string
  suggestedSlot: ReadingSlot | null
}

const cleanNumber = (value: string): string => {
  const fixed = value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/,/g, '.').replace(/\s+/g, '')
  const match = fixed.match(/(\d{4,9})\.(\d{3})/)
  if (!match) return ''
  const result = `${match[1]}.${match[2]}`
  const amount = Number(result)
  // Pump totalizer litres; CumSale जैसी बहुत बड़ी रकम को reject करें।
  return amount >= 10_000 && amount < 10_000_000 ? result : ''
}

const imageSize = (file: File): Promise<{ width: number; height: number }> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    resolve({ width: image.naturalWidth, height: image.naturalHeight })
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('Image load failed'))
  }
  image.src = url
})

// IndianOil की 4-nozzle slip में CumVolume values एक fixed vertical order में होती हैं।
// पूरी photo का slow/free-form OCR करने के बजाय केवल चार पतली reading lines scan होती हैं।
const LINE_TOP_RATIOS = [0.2734, 0.4785, 0.7080, 0.9717]

export async function scanReceipt(file: File, onProgress: (progress: number, status: string) => void): Promise<ScanResult> {
  const { width, height } = await imageSize(file)
  let completed = 0
  const worker = await createWorker('eng', 1, {
    logger: message => {
      if (message.status === 'recognizing text') onProgress((completed + message.progress) / 4, message.status)
      else onProgress(0, message.status)
    }
  })

  const readings = ['', '', '', '']
  const texts: string[] = []
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: '0123456789.,',
      user_defined_dpi: '300'
    })

    for (let index = 0; index < 4; index += 1) {
      const top = Math.min(height - 1, Math.max(0, Math.round(height * LINE_TOP_RATIOS[index])))
      const rectangle = {
        left: Math.round(width * 0.30),
        top,
        width: Math.round(width * 0.55),
        height: Math.max(50, Math.min(height - top, Math.round(height * 0.020)))
      }
      const { data } = await worker.recognize(file, { rectangle })
      texts[index] = data.text
      readings[index] = cleanNumber(data.text)
      completed = index + 1
      onProgress(completed / 4, 'recognizing text')
    }

    // यदि framing थोड़ा ऊपर/नीचे हो तो missing line पर एक wider fallback scan करें।
    if (readings.some(value => !value)) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
      for (let index = 0; index < 4; index += 1) {
        if (readings[index]) continue
        const top = Math.max(0, Math.round(height * (LINE_TOP_RATIOS[index] - 0.018)))
        const rectangle = {
          left: Math.round(width * 0.30),
          top,
          width: Math.round(width * 0.48),
          height: Math.max(100, Math.min(height - top, Math.round(height * 0.055)))
        }
        const { data } = await worker.recognize(file, { rectangle })
        texts[index] += `\n${data.text}`
        readings[index] = cleanNumber(data.text)
      }
    }

    // Nozzle 1 की line ऊपर हल्की/तिरछी होती है। उसके लिए छोटा high-focus retry रखें।
    if (!readings[0]) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
      const top = Math.max(0, Math.round(height * 0.266))
      const { data } = await worker.recognize(file, {
        rectangle: {
          left: Math.round(width * 0.325),
          top,
          width: Math.round(width * 0.39),
          height: Math.max(90, Math.min(height - top, Math.round(height * 0.035)))
        }
      })
      texts[0] += `\nT1 focused retry:\n${data.text}`
      readings[0] = cleanNumber(data.text)
    }

    return {
      readings,
      confidence: readings.filter(Boolean).length * 25,
      rawText: texts.map((text, index) => `T${index + 1}: ${text.trim() || 'not found'}`).join('\n'),
      slipTime: '',
      suggestedSlot: null
    }
  } finally {
    await worker.terminate()
  }
}
