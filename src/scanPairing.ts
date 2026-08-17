import type { ReadingSlot } from './receiptOcr'

export type PairedReading = { morning: string; evening: string }

const number = (value: string) => Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : 0

/** Applies one verified slip without inventing values beyond ShDayVol arithmetic. */
export function applySlipToPair(
  existing: PairedReading[],
  values: string[],
  slot: ReadingSlot,
  dayVolumes: string[],
  allowOppositeDerivation = false
): PairedReading[] {
  return existing.map((reading, index) => {
    let morning = reading.morning, evening = reading.evening
    const scanned = values[index] ?? ''
    const hasDayVolume = (dayVolumes[index] ?? '') !== ''
    const dayVolume = number(dayVolumes[index] ?? '')
    if (slot === 'evening') {
      // A cumulative closing cannot be below an existing opening. Reject an
      // OCR neighbour such as ShMTHSale instead of storing a negative sale.
      if (scanned && (!morning || number(scanned) >= number(morning))) evening = scanned
      else if (!scanned && morning && hasDayVolume) evening = (number(morning) + dayVolume).toFixed(3)
      // Do not fill Morning from one Evening slip alone. Only pair after the
      // scanner has evidence that the Morning slip/entry already exists.
      if (allowOppositeDerivation && !morning && evening && hasDayVolume) {
        const derived = number(evening) - dayVolume
        if (derived >= 0) morning = derived.toFixed(3)
      }
    } else if (scanned && (!evening || number(scanned) <= number(evening))) {
      // Morning alone never creates a fake closing from zero ShDayVol.
      morning = scanned
    }
    return { ...reading, morning, evening }
  })
}
