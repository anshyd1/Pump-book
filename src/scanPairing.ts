import type { ReadingSlot } from './receiptOcr'

export type PairedReading = { morning: string; evening: string }
export type DayVolumeMismatch = {
  nozzle: number
  opening: number
  closing: number
  calculated: number
  printed: number
}
export type DifferenceOutlier = { nozzle: number; difference: number; median: number }

const number = (value: string) => Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : 0

/**
 * The shift report gives us an independent invariant: Closing - Opening must
 * equal the printed ShDayVol. This catches a plausible-looking neighbouring
 * OCR number even when it creates a large positive (rather than negative) sale.
 */
export function dayVolumeMismatches(
  readings: PairedReading[],
  dayVolumes: string[],
  tolerance = 0.05
): DayVolumeMismatch[] {
  return readings.flatMap((reading, index) => {
    const printedText = dayVolumes[index] ?? ''
    if (!reading.morning || !reading.evening || printedText === '') return []
    const opening = number(reading.morning)
    const closing = number(reading.evening)
    const printed = number(printedText)
    // Morning reports commonly print 0.000. It is not closing evidence.
    if (printed <= 0) return []
    const calculated = closing - opening
    return Math.abs(calculated - printed) <= tolerance
      ? []
      : [{ nozzle: index + 1, opening, closing, calculated, printed }]
  })
}

/**
 * Magnitude-independent fallback for receipts whose ShDayVol was unreadable.
 * It compares nozzles with each other rather than hard-coding a pump totalizer
 * or daily-sale ceiling. A difference over 100× the shift median is held for
 * review, which catches the reported 1,230,535 L T1 without rejecting normal
 * variation between nozzles.
 */
export function extremeDifferenceOutliers(readings: PairedReading[], factor = 100): DifferenceOutlier[] {
  const values = readings.map((reading, index) => ({
    nozzle: index + 1,
    complete: Boolean(reading.morning && reading.evening),
    difference: number(reading.evening) - number(reading.morning)
  }))
  const positive = values.filter(item => item.complete && item.difference > 0).map(item => item.difference).sort((a, b) => a - b)
  if (positive.length < 3) return []
  const middle = Math.floor(positive.length / 2)
  const median = positive.length % 2 ? positive[middle] : (positive[middle - 1] + positive[middle]) / 2
  if (median <= 0) return []
  return values.filter(item => item.complete && item.difference > median * factor).map(item => ({ nozzle: item.nozzle, difference: item.difference, median }))
}

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
