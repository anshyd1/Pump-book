import assert from 'node:assert/strict'
import test from 'node:test'
import type { NativeBox, NativeMlKitResult } from '../src/nativeOcr'
import { associatePumpFields } from '../src/structuredOcr'
import { applySlipToPair, dayVolumeMismatches, extremeDifferenceOutliers } from '../src/scanPairing'
import { parseDocumentText } from '../src/receiptOcr'

const line = (text: string, top: number, blockIndex: number, lineIndex: number): NativeBox => ({
  text, left: 30, top, right: 330, bottom: top + 16, blockIndex, lineIndex
})

const receipt = (cum: string[], day: string[]): NativeMlKitResult => {
  const lines: NativeBox[] = []
  for (let nozzle = 1; nozzle <= 4; nozzle += 1) {
    const base = (nozzle - 1) * 140
    lines.push(line(`Nozzle No ${nozzle}`, base, nozzle - 1, 0))
    lines.push(line('CumVolume', base + 25, nozzle - 1, 1))
    if (cum[nozzle - 1]) lines.push(line(cum[nozzle - 1], base + 48, nozzle - 1, 2))
    lines.push(line('ShDayVol', base + 76, nozzle - 1, 3))
    if (day[nozzle - 1]) lines.push(line(day[nozzle - 1], base + 99, nozzle - 1, 4))
  }
  return {
    text: lines.map(item => item.text).join('\n'),
    width: 400,
    height: 600,
    blocks: [],
    lines,
    timings: { ocrMs: 100, beforeSerializeMs: 101, serializeMs: 1, totalMs: 102 }
  }
}

const expectedMorning = ['499243.148', '501071.921', '110538.129', '478449.884']
const expectedEvening = ['499590.788', '502042.401', '110544.109', '478519.314']
const dayVolumes = ['347.640', '970.480', '5.980', '69.430']

test('ML Kit line boxes associate each CumVolume and ShDayVol with Nozzle 1–4', () => {
  const parsed = associatePumpFields(receipt(expectedEvening, dayVolumes))
  assert.deepEqual(parsed.readings, expectedEvening)
  assert.deepEqual(parsed.dayVolumes, dayVolumes)
  assert.equal(parsed.associations.length, 8)
  assert.deepEqual(parsed.associations.map(item => item.nozzle), [1, 1, 2, 2, 3, 3, 4, 4])
})

test('real field OCR spacing and Nozzle Nol confusion still associate correctly', () => {
  const noisy = receipt(expectedEvening, dayVolumes)
  noisy.lines = noisy.lines.map(item => ({
    ...item,
    text: item.text
      .replace('Nozzle No 1', 'Nozzle Nol')
      .replace(/(\d{6})\.(\d{3})/, '$1. $2')
      .replace('347.640', '347, 640')
  }))
  noisy.text = noisy.lines.map(item => item.text).join('\n')
  const parsed = associatePumpFields(noisy)
  assert.deepEqual(parsed.readings, expectedEvening)
  assert.deepEqual(parsed.dayVolumes, dayVolumes)
})

test('missing CumVolume never steals ShMTHSale from above the label', () => {
  const lines = [
    line('Nozzle No4', 0, 0, 0),
    line('ShMTHSale:', 24, 0, 1),
    line('388028.470', 46, 0, 2),
    line('ShMTHVol :4063.120', 68, 0, 3),
    line('CumVolume:', 92, 0, 4),
    line('CumSale :42747367.730', 136, 0, 5)
  ]
  const parsed = associatePumpFields({
    text: lines.map(item => item.text).join('\n'), width: 400, height: 180,
    blocks: [], lines,
    timings: { ocrMs: 100, beforeSerializeMs: 101, serializeMs: 1, totalMs: 102 }
  })
  assert.equal(parsed.readings[3], '')
})

test('one evening slip never fills the unscanned morning column', () => {
  const empty = Array.from({ length: 4 }, () => ({ morning: '', evening: '' }))
  const oneSlip = applySlipToPair(empty, expectedEvening, 'evening', dayVolumes)
  assert.deepEqual(oneSlip.map(item => item.morning), ['', '', '', ''])
  assert.deepEqual(oneSlip.map(item => item.evening), expectedEvening)
})

test('closing below opening is rejected before it can create a negative sale', () => {
  const existing = [
    { morning: '', evening: '' }, { morning: '', evening: '' },
    { morning: '', evening: '' }, { morning: '478449.884', evening: '' }
  ]
  const result = applySlipToPair(existing, ['', '', '', '388028.470'], 'evening', ['', '', '', '69.430'], true)
  assert.equal(result[3].evening, '')
  assert.equal(result[3].morning, '478449.884')
})

test('morning/evening fixture reconciliation produces all 8 documented readings', () => {
  // Simulate the actual uploaded photos conservatively: the morning pen marks
  // can leave only T1/T4 directly safe, while the evening edge can lose T4.
  // Evening ShDayVol safely recovers morning T2/T3 and evening T4.
  const morningOcr = associatePumpFields(receipt([
    expectedMorning[0], '', '', expectedMorning[3]
  ], ['', '', '', '']))
  const eveningOcr = associatePumpFields(receipt([
    expectedEvening[0], expectedEvening[1], expectedEvening[2], ''
  ], dayVolumes))

  const empty = Array.from({ length: 4 }, () => ({ morning: '', evening: '' }))
  const afterMorning = applySlipToPair(empty, morningOcr.readings, 'morning', morningOcr.dayVolumes)
  const complete = applySlipToPair(afterMorning, eveningOcr.readings, 'evening', eveningOcr.dayVolumes, true)

  assert.deepEqual(complete.map(item => item.morning), expectedMorning)
  assert.deepEqual(complete.map(item => item.evening), expectedEvening)
})

test('printed ShDayVol blocks the huge-positive T1 screenshot failure', () => {
  const bad = [
    { morning: '18642.315', evening: '1249178.182' },
    { morning: '2506340.875', evening: '2507529.500' },
    { morning: '987654.321', evening: '987890.801' },
    { morning: '4752880.640', evening: '4753776.000' }
  ]
  const mismatches = dayVolumeMismatches(bad, ['412.750', '1188.625', '236.480', '895.360'])
  assert.deepEqual(mismatches.map(item => item.nozzle), [1])
  assert.equal(mismatches[0].calculated.toFixed(3), '1230535.867')
  assert.deepEqual(extremeDifferenceOutliers(bad).map(item => item.nozzle), [1])
})

test('normal nozzle variation does not trigger magnitude-independent outlier hold', () => {
  const pair = [
    { morning: '100000.000', evening: '100120.000' },
    { morning: '200000.000', evening: '201100.000' },
    { morning: '300000.000', evening: '300240.000' },
    { morning: '400000.000', evening: '400900.000' }
  ]
  assert.deepEqual(extremeDifferenceOutliers(pair), [])
})

test('matching generated receipt pair passes independent ShDayVol verification', () => {
  const pair = [
    { morning: '1248765.432', evening: '1249178.182' },
    { morning: '2506340.875', evening: '2507529.500' },
    { morning: '987654.321', evening: '987890.801' },
    { morning: '4752880.640', evening: '4753776.000' }
  ]
  assert.deepEqual(dayVolumeMismatches(pair, ['412.750', '1188.625', '236.480', '895.360']), [])
})

test('text fallback stops at another field instead of stealing ShMTHVol or CumSale', () => {
  const parsed = parseDocumentText([
    'Nozzle No1',
    'CumVolume:',
    'ShMTHVol : 1234567.890',
    'CumSale : 7654321.000',
    'Nozzle No2',
    'CumVolume:',
    '2507529.500'
  ].join('\n'))
  assert.equal(parsed[0], '')
  assert.equal(parsed[1], '2507529.500')
})
