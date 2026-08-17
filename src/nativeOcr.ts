import { Capacitor, registerPlugin } from '@capacitor/core'

type MlKitResult = { text: string; width: number; height: number }
interface MlKitOcrPlugin { recognize(options: { base64: string }): Promise<MlKitResult> }
const MlKitOcr = registerPlugin<MlKitOcrPlugin>('MlKitOcr')

export const nativeMlKitAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const optimizedDataUrl = (source: HTMLCanvasElement): Promise<string> => new Promise((resolve, reject) => {
  // Keep enough detail for ML Kit while avoiding a multi-megabyte synchronous WebView bridge payload.
  const scale = Math.min(1, 1600 / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale))
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  canvas.toBlob(blob => {
    if (!blob) { reject(new Error('Native OCR image encode failed')); return }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Native OCR image read failed'))
    reader.readAsDataURL(blob)
  }, 'image/jpeg', .88)
})

export async function recognizeWithMlKit(canvas: HTMLCanvasElement): Promise<string | null> {
  if (!nativeMlKitAvailable()) return null
  try {
    const base64 = await optimizedDataUrl(canvas)
    const result = await Promise.race([
      MlKitOcr.recognize({ base64 }),
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Native ML Kit timeout')), 8_000))
    ])
    return result.text || null
  } catch (error) {
    console.warn('Native ML Kit OCR unavailable, using Tesseract fallback', error)
    return null
  }
}
