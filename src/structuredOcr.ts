import type { NativeBox, NativeMlKitResult } from './nativeOcr'

export type FieldAssociation = {
  nozzle: number
  field: 'CumVolume' | 'ShDayVol'
  value: string
  labelText: string
  valueText: string
  labelBox: Pick<NativeBox, 'left' | 'top' | 'right' | 'bottom'>
  valueBox: Pick<NativeBox, 'left' | 'top' | 'right' | 'bottom'>
}
export type StructuredPumpFields = {
  readings: string[]
  dayVolumes: string[]
  associations: FieldAssociation[]
}

type IndexedLine = NativeBox & { order: number; height: number; centreX: number }
type Anchor = { nozzle: number; line: IndexedLine }
type LabelKind = FieldAssociation['field']

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
const normalizeDigits = (text: string) => text
  .replace(/[Oo]/g, '0')
  .replace(/[Il|]/g, '1')
  .replace(/[%]/g, '8')
  .replace(/[Gg](?=\d)/g, '4')
  .replace(/,/g, '.')
  .replace(/[ \t]+/g, '')

const decimalCandidates = (text: string, minimumIntegerDigits: number, maximum: number): string[] => {
  const pattern = new RegExp(`(\\d{${minimumIntegerDigits},9})\\.(\\d{3})`, 'g')
  return Array.from(normalizeDigits(text).matchAll(pattern))
    .map(match => `${match[1]}.${match[2]}`)
    .filter(value => Number(value) >= 0 && Number(value) < maximum)
}

const nozzleNumber = (text: string): number | null => {
  const value = compact(text)
  // Tolerate the common ML Kit confusions in “Nozzle No 1”.
  const match = value.match(/n[o0][z2][z2][l1i][e3](?:n[o0])?([1-4li])/i)
    ?? value.match(/(?:nozzle|n0zzle|nozz1e).*?([1-4li])/i)
  if (!match) return null
  return /[li]/i.test(match[1]) ? 1 : Number(match[1])
}
const labelKind = (text: string): LabelKind | null => {
  const value = compact(text)
  if (/(?:cum|sum|curn)(?:volume|vol|v0l)/.test(value)) return 'CumVolume'
  if (/(?:sh|shift)?(?:day|bay|pay)(?:volume|vol|v0l)/.test(value)) return 'ShDayVol'
  return null
}
const isKnownFieldLabel = (text: string) => {
  const value = compact(text)
  return /(?:sh|shi|shift|cum|curn|sum)(?:f?[123]|day|mth)?(?:sale|volume|vol|v0l)/.test(value)
}
const numbersFor = (text: string, kind: LabelKind) => kind === 'CumVolume'
  ? decimalCandidates(text, 6, 10_000_000)
  : decimalCandidates(text, 1, 100_000)

const indexedLines = (result: NativeMlKitResult): IndexedLine[] => result.lines
  .map((line, order) => ({
    ...line,
    order,
    height: Math.max(1, line.bottom - line.top),
    centreX: (line.left + line.right) / 2
  }))
  .sort((a, b) => a.top - b.top || a.left - b.left)

const boxOf = (line: IndexedLine) => ({ left: line.left, top: line.top, right: line.right, bottom: line.bottom })

const selectValueLine = (
  label: IndexedLine,
  kind: LabelKind,
  section: IndexedLine[],
  boundaryBottom: number
): { line: IndexedLine; value: string } | null => {
  const options: { line: IndexedLine; value: string; score: number }[] = []
  for (const line of section) {
    if (line.top >= boundaryBottom) continue
    const values = numbersFor(line.text, kind)
    if (!values.length) continue
    const overlapsLabelRow = line.bottom >= label.top && line.top <= label.bottom
    // On these receipts CumVolume/ShDayVol is printed on the label row or
    // below it. Never pull ShMTHSale/ShMTHVol from above a missing CumVolume.
    if (line !== label && !overlapsLabelRow && line.top < label.top) continue
    const verticalGap = overlapsLabelRow ? 0 : Math.max(0, line.top - label.bottom)
    // Reject distant monthly/sale numbers instead of forcing a match.
    if (line !== label && verticalGap > label.height * 4.5) continue
    const vertical = verticalGap
    // Same block and horizontal overlap make a label/value pair much more likely.
    const overlap = Math.max(0, Math.min(label.right, line.right) - Math.max(label.left, line.left))
    const sameBlockBonus = line.blockIndex === label.blockIndex ? label.height * 1.5 : 0
    const overlapBonus = overlap > 0 ? label.height : 0
    const sameLineBonus = line === label ? label.height * 5 : 0
    const score = vertical - sameBlockBonus - overlapBonus - sameLineBonus + Math.abs(line.centreX - label.centreX) * 0.015
    options.push({ line, value: values[0], score })
  }
  options.sort((a, b) => a.score - b.score || a.line.top - b.line.top)
  return options[0] ?? null
}

const sectionForNozzle = (lines: IndexedLine[], anchors: Anchor[], nozzle: number) => {
  const current = anchors.find(anchor => anchor.nozzle === nozzle)
  const next = anchors.filter(anchor => anchor.line.top > (current?.line.top ?? -1)).sort((a, b) => a.line.top - b.line.top)[0]
  let top = current?.line.top ?? 0
  let bottom = next?.line.top ?? Number.POSITIVE_INFINITY

  // Some receipts crop the first “Nozzle 1” heading. Everything before Nozzle 2
  // is still T1's section, but only for this missing first anchor case.
  if (nozzle === 1 && !current) {
    const nozzleTwo = anchors.find(anchor => anchor.nozzle === 2)
    bottom = nozzleTwo?.line.top ?? Number.POSITIVE_INFINITY
  }
  if (!current && nozzle !== 1) return { lines: [] as IndexedLine[], bottom }
  return { lines: lines.filter(line => line.top >= top && line.top < bottom), bottom }
}

/**
 * Associates fields geometrically instead of flattening ML Kit output into a
 * regex-only string. Nozzle headings create vertical sections; each label is
 * paired with the closest plausible value line using bounding boxes/blocks.
 */
export function associatePumpFields(result: NativeMlKitResult): StructuredPumpFields {
  const lines = indexedLines(result)
  const anchors: Anchor[] = lines
    .map(line => ({ nozzle: nozzleNumber(line.text), line }))
    .filter((item): item is Anchor => item.nozzle !== null)
    .sort((a, b) => a.line.top - b.line.top)
  const readings = ['', '', '', '']
  const dayVolumes = ['', '', '', '']
  const associations: FieldAssociation[] = []

  const assign = (nozzle: number, kind: LabelKind, section: IndexedLine[], bottom: number) => {
    const labels = section.filter(line => labelKind(line.text) === kind)
    if (!labels.length) return
    const label = labels[0]
    const nextLabel = section
      .filter(line => line.top > label.top && isKnownFieldLabel(line.text))
      .sort((a, b) => a.top - b.top)[0]
    const selected = selectValueLine(label, kind, section, Math.min(bottom, nextLabel?.top ?? bottom))
    if (!selected) return
    if (kind === 'CumVolume') readings[nozzle - 1] = selected.value
    else dayVolumes[nozzle - 1] = selected.value
    associations.push({
      nozzle,
      field: kind,
      value: selected.value,
      labelText: label.text,
      valueText: selected.line.text,
      labelBox: boxOf(label),
      valueBox: boxOf(selected.line)
    })
  }

  if (anchors.length) {
    for (let nozzle = 1; nozzle <= 4; nozzle += 1) {
      const section = sectionForNozzle(lines, anchors, nozzle)
      assign(nozzle, 'CumVolume', section.lines, section.bottom)
      assign(nozzle, 'ShDayVol', section.lines, section.bottom)
    }
  } else {
    // If all nozzle headings are cropped, labels remain vertically ordered.
    for (const kind of ['CumVolume', 'ShDayVol'] as const) {
      const labels = lines.filter(line => labelKind(line.text) === kind).slice(0, 4)
      labels.forEach((label, index) => {
        const next = labels[index + 1]
        const selected = selectValueLine(label, kind, lines.filter(line => line.top >= label.top), next?.top ?? Number.POSITIVE_INFINITY)
        if (!selected) return
        if (kind === 'CumVolume') readings[index] = selected.value
        else dayVolumes[index] = selected.value
        associations.push({
          nozzle: index + 1,
          field: kind,
          value: selected.value,
          labelText: label.text,
          valueText: selected.line.text,
          labelBox: boxOf(label),
          valueBox: boxOf(selected.line)
        })
      })
    }
  }
  return { readings, dayVolumes, associations }
}
