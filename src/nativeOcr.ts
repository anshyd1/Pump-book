import { Capacitor, registerPlugin } from '@capacitor/core'

export type NativeBox = {
  text: string
  left: number
  top: number
  right: number
  bottom: number
  blockIndex: number
  lineIndex?: number
}
export type NativeTextBlock = NativeBox & { lines: NativeBox[] }
export type NativeMlKitResult = {
  text: string
  width: number
  height: number
  blocks: NativeTextBlock[]
  lines: NativeBox[]
  timings: { ocrMs: number; beforeSerializeMs: number; serializeMs: number; totalMs: number }
}
export type NativeDocumentResult = NativeMlKitResult & {
  imageUri: string
  previewUri: string
  sizeBytes: number
  processingMs: number
}

type ScannedDocument = { uri: string; sizeBytes: number }
interface MlKitOcrPlugin {
  scanDocument(): Promise<ScannedDocument>
  pickImage(): Promise<ScannedDocument>
  recognize(options: { uri: string }): Promise<NativeMlKitResult>
}
const MlKitOcr = registerPlugin<MlKitOcrPlugin>('MlKitOcr')

export const nativeMlKitAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const withTimeout = <T>(work: Promise<T>, milliseconds: number, message: string): Promise<T> => Promise.race([
  work,
  new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error(message)), milliseconds))
])

/**
 * Native happy path: ML Kit Document Scanner writes a perspective-corrected
 * JPEG in app cache, then the WebView sends only that temporary content URI
 * back to ML Kit Text Recognition. Image bytes never cross the JS bridge.
 */
export async function scanAndRecognizeNativeDocument(source: 'document' | 'gallery' = 'document'): Promise<NativeDocumentResult | null> {
  if (!nativeMlKitAvailable()) return null
  try {
    const scanned = source === 'gallery' ? await MlKitOcr.pickImage() : await MlKitOcr.scanDocument()
    // Start the performance clock only after the user confirms the corrected
    // page, so camera framing time is not mixed into capture-to-result timing.
    const processingStarted = performance.now()
    const recognized = await withTimeout(
      MlKitOcr.recognize({ uri: scanned.uri }),
      8_000,
      'Native ML Kit timeout'
    )
    const processingMs = Math.round(performance.now() - processingStarted)
    console.info('[PumpBookScan]', {
      stage: 'native-complete',
      processingMs,
      image: `${recognized.width}x${recognized.height}`,
      blocks: recognized.blocks.length,
      lines: recognized.lines.length,
      nativeTimings: recognized.timings
    })
    return {
      ...recognized,
      imageUri: scanned.uri,
      previewUri: Capacitor.convertFileSrc(scanned.uri),
      sizeBytes: scanned.sizeBytes,
      processingMs
    }
  } catch (error) {
    if (error instanceof Error && /(?:DOCUMENT_SCAN|IMAGE_PICK)_CANCELLED/.test(error.message)) return null
    console.warn('[PumpBookScan] Native document scan unavailable; PWA upload remains available', error)
    throw error
  }
}
