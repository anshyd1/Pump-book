type Props = { compact?: boolean; animated?: boolean; className?: string }

/** Offline vector mark: fuel drop + ledger pages + PB monogram + gauge. */
export default function BrandLogo({ compact = false, animated = true, className = '' }: Props) {
  return <svg
    className={`pb-logo ${compact ? 'compact' : ''} ${animated ? 'is-animated' : ''} ${className}`}
    viewBox="0 0 160 180" role="img" aria-label="Pump Book fuel drop logo"
  >
    <defs>
      <linearGradient id="pb-drop" x1="24" y1="12" x2="139" y2="168" gradientUnits="userSpaceOnUse">
        <stop stopColor="#54f1c6"/><stop offset=".5" stopColor="#07967d"/><stop offset="1" stopColor="#075267"/>
      </linearGradient>
      <linearGradient id="pb-gold" x1="42" y1="128" x2="122" y2="153" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffd86d"/><stop offset="1" stopColor="#ed8d25"/>
      </linearGradient>
      <filter id="pb-shadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#00191d" floodOpacity=".28"/>
      </filter>
    </defs>
    <g className="pb-logo-drop" filter="url(#pb-shadow)">
      <path d="M80 7C65 32 25 68 25 111c0 34 24 61 55 61s55-27 55-61C135 68 95 32 80 7Z" fill="url(#pb-drop)"/>
      <path d="M45 102c10-29 31-49 43-65" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="7" strokeLinecap="round"/>
    </g>
    <g className="pb-logo-book">
      <path d="M45 123c12-6 24-5 35 2v30c-11-7-23-8-35-2v-30Z" fill="#fff" fillOpacity=".96"/>
      <path d="M115 123c-12-6-24-5-35 2v30c11-7 23-8 35-2v-30Z" fill="#e9fffa"/>
      <path d="M80 125v30" stroke="#087d70" strokeWidth="2"/>
      <path d="M51 132c8-3 15-2 23 2M51 140c8-3 15-2 23 2M109 132c-8-3-15-2-23 2M109 140c-8-3-15-2-23 2" fill="none" stroke="#19a68b" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round"/>
    </g>
    <g className="pb-logo-gauge">
      <path d="M52 104a31 31 0 0 1 56 0" fill="none" stroke="#dffff7" strokeOpacity=".56" strokeWidth="5" strokeLinecap="round"/>
      <path d="M80 98 99 80" stroke="url(#pb-gold)" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="80" cy="98" r="6" fill="#ffca55"/>
    </g>
    <text x="80" y="76" textAnchor="middle" fill="#fff" fontFamily="system-ui, sans-serif" fontSize="27" fontWeight="950" letterSpacing="-2">PB</text>
    <g className="pb-logo-spark" fill="#ffd568">
      <path d="m128 45 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>
      <circle cx="35" cy="78" r="3"/>
    </g>
  </svg>
}
