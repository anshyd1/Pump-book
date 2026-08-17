import { strToU8, zipSync } from 'fflate'
import type { ScanResult } from './receiptOcr'

const anonymizeOcr = (text: string) => text
  .replace(/((?:pump|machine)\s*s?\.?\s*no\.?\s*[:#-]?\s*)[a-z0-9-]+/gi, '$1[REDACTED]')
  .replace(/((?:mobile|phone|gstin|address|dealer)\s*[:#-]?\s*)[^\n]+/gi, '$1[REDACTED]')

const save = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export async function exportScanDiagnostics(
  result: ScanResult,
  originalFile: File | null,
  previewUri: string
): Promise<void> {
  const sanitizedText = anonymizeOcr(result.rawText)
  const manifest = {
    exportedAt: new Date().toISOString(),
    note: 'User-triggered diagnostic export. OCR identifiers are redacted; CumVolume/ShDayVol readings are preserved for debugging.',
    result: {
      readings: result.readings,
      dayVolumes: result.dayVolumes,
      confidence: result.confidence,
      suggestedSlot: result.suggestedSlot
    },
    diagnostics: result.diagnostics
  }
  const entries: Record<string, Uint8Array> = {
    'diagnostics.json': strToU8(JSON.stringify(manifest, null, 2)),
    'ocr-anonymized.txt': strToU8(sanitizedText)
  }
  try {
    const bytes = originalFile
      ? new Uint8Array(await originalFile.arrayBuffer())
      : previewUri
        ? new Uint8Array(await (await fetch(previewUri)).arrayBuffer())
        : null
    if (bytes?.length) entries['perspective-corrected-scan.jpg'] = bytes
  } catch (error) {
    entries['image-export-error.txt'] = strToU8(String(error))
  }
  const zip = zipSync(entries, { level: 6 })
  save(new Blob([zip as BlobPart], { type: 'application/zip' }), `pump-book-scan-diagnostics-${Date.now()}.zip`)
}
