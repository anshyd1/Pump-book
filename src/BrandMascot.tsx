type Props = { compact?: boolean; scanning?: boolean }

export default function BrandMascot({ compact = false, scanning = false }: Props) {
  return <svg className={`pump-pal ${compact ? 'compact' : ''} ${scanning ? 'is-scanning' : ''}`} viewBox="0 0 120 120" role="img" aria-label="Pump Book mascot Pumpu">
    <defs>
      <linearGradient id="drop" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffcc4d"/><stop offset="1" stopColor="#ff8a34"/></linearGradient>
      <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#18b891"/><stop offset="1" stopColor="#087a69"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse className="mascot-shadow" cx="60" cy="108" rx="34" ry="7" fill="#001f2d" opacity=".2"/>
    <path className="mascot-drop" d="M60 8C50 25 35 40 35 57a25 25 0 0 0 50 0C85 40 70 25 60 8Z" fill="url(#drop)"/>
    <rect x="31" y="45" width="58" height="55" rx="17" fill="url(#body)" stroke="#fff" strokeWidth="3"/>
    <rect x="39" y="54" width="42" height="29" rx="8" fill="#f7fffc"/>
    <path d="M46 61h28M46 67h20M46 73h25" stroke="#86a9a2" strokeWidth="3" strokeLinecap="round"/>
    <circle className="mascot-eye left" cx="49" cy="89" r="3.2" fill="#062d39"/>
    <circle className="mascot-eye right" cx="71" cy="89" r="3.2" fill="#062d39"/>
    <path d="M55 94c3 3 7 3 10 0" fill="none" stroke="#062d39" strokeWidth="2.5" strokeLinecap="round"/>
    <path className="mascot-arm left" d="M32 70c-9 1-12 7-13 14" fill="none" stroke="#087a69" strokeWidth="7" strokeLinecap="round"/>
    <path className="mascot-arm right" d="M88 70c9 1 12 7 13 14" fill="none" stroke="#087a69" strokeWidth="7" strokeLinecap="round"/>
    <circle className="scan-spark one" cx="97" cy="33" r="4" fill="#52e7c3" filter="url(#glow)"/>
    <circle className="scan-spark two" cx="106" cy="49" r="2.5" fill="#ffcc4d" filter="url(#glow)"/>
    <path className="scan-beam" d="M22 54h76" stroke="#7fffe0" strokeWidth="3" strokeLinecap="round" opacity="0"/>
  </svg>
}
