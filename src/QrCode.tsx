import { QR_CODES } from './qrCodes'
import type { QrTarget } from './qrCodes'

type Props = {
  target: QrTarget
  /** Rendered size in px. Vector output stays sharp at any value. */
  size?: number
  label?: string
  /** Dark module colour. Keep the contrast ratio high for reliable scanning. */
  tone?: string
}

/**
 * Vector QR code rendered from build-time path data (see scripts/generate-qr.mjs).
 *
 * The four-module quiet zone required by the QR spec is baked into the viewBox,
 * so the code scans correctly even when placed directly against a coloured card.
 */
export default function QrCode({ target, size = 176, label, tone = '#04231f' }: Props) {
  const code = QR_CODES[target]
  const quiet = 4
  const extent = code.size + quiet * 2

  return (
    <figure className="qr-figure" style={{ width: size }}>
      <svg
        className="qr-svg"
        viewBox={`0 0 ${extent} ${extent}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label={label ?? `QR code for ${code.url}`}
      >
        <rect width={extent} height={extent} fill="#ffffff" rx={1.5} />
        <g transform={`translate(${quiet} ${quiet})`}>
          <path d={code.path} fill={tone} />
        </g>
      </svg>
      {label ? <figcaption>{label}</figcaption> : null}
    </figure>
  )
}
