import { useEffect, useRef, useState } from 'react'

/**
 * Cinematic hero animation: a fuel nozzle pours a live stream into a rising
 * tank while the totalizer digits roll and settle on the documented fixture
 * value. Pure SVG + CSS so it costs no dependency and scales to any screen.
 *
 * Honours prefers-reduced-motion by holding the final frame instead of looping.
 */

const FINAL_LITRES = 2733.215
const FINAL_RUPEES = 265248.52

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const litres = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

function useCountUp(target: number, duration: number, reduced: boolean) {
  const [value, setValue] = useState(reduced ? target : 0)
  const frame = useRef(0)

  useEffect(() => {
    if (reduced) { setValue(target); return }
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      // easeOutExpo — fast spin that decelerates into place like a real totalizer
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setValue(target * eased)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, reduced])

  return value
}

export default function FuelStage() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const volume = useCountUp(FINAL_LITRES, 2600, reduced)
  const amount = useCountUp(FINAL_RUPEES, 3000, reduced)

  return (
    <div className={`fuel-stage${reduced ? ' is-still' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 420 460" className="fuel-stage-svg">
        <defs>
          <linearGradient id="fs-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0d5f74" />
            <stop offset="0.55" stopColor="#07414f" />
            <stop offset="1" stopColor="#032430" />
          </linearGradient>
          <linearGradient id="fs-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a3b34" />
            <stop offset="1" stopColor="#04231f" />
          </linearGradient>
          <linearGradient id="fs-fuel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe07a" />
            <stop offset="0.5" stopColor="#ffb545" />
            <stop offset="1" stopColor="#ef8a24" />
          </linearGradient>
          <linearGradient id="fs-stream" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd86d" stopOpacity="0.15" />
            <stop offset="0.35" stopColor="#ffca55" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ff9d3d" />
          </linearGradient>
          <linearGradient id="fs-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
          <radialGradient id="fs-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffca55" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffca55" stopOpacity="0" />
          </radialGradient>
          <filter id="fs-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <clipPath id="fs-tank">
            <rect x="243" y="243" width="126" height="176" rx="20" />
          </clipPath>
        </defs>

        {/* ambient glow behind the rig */}
        <ellipse cx="210" cy="404" rx="176" ry="34" fill="url(#fs-glow)" filter="url(#fs-blur)" />

        {/* dispenser body */}
        <g className="fs-rig">
          <rect x="52" y="66" width="176" height="330" rx="28" fill="url(#fs-body)" />
          <rect
            x="52" y="66" width="176" height="330" rx="28"
            fill="none" stroke="#54f1c6" strokeOpacity="0.32" strokeWidth="1.5"
          />
          <rect x="52" y="66" width="176" height="330" rx="28" fill="url(#fs-glass)" />

          {/* totalizer screen */}
          <rect x="74" y="94" width="132" height="86" rx="14" fill="url(#fs-screen)" />
          <rect
            x="74" y="94" width="132" height="86" rx="14"
            fill="none" stroke="#54f1c6" strokeOpacity="0.42" strokeWidth="1.2"
          />
          <text x="88" y="118" className="fs-screen-label">LITRES</text>
          <text x="192" y="146" className="fs-screen-value" textAnchor="end">
            {litres.format(volume)}
          </text>
          <text x="192" y="168" className="fs-screen-sub" textAnchor="end">
            ₹ {inr.format(amount)}
          </text>

          {/* scan sweep across the screen */}
          <rect x="74" y="94" width="132" height="86" rx="14" className="fs-scan" />

          {/* nozzle holster + grill detail */}
          <rect x="74" y="200" width="132" height="10" rx="5" fill="#0a4a58" />
          <rect x="74" y="220" width="132" height="6" rx="3" fill="#0a4a58" opacity="0.7" />
          <rect x="74" y="236" width="88" height="6" rx="3" fill="#0a4a58" opacity="0.5" />

          {/* status lamps */}
          <circle cx="90" cy="374" r="7" className="fs-lamp fs-lamp-a" />
          <circle cx="112" cy="374" r="7" className="fs-lamp fs-lamp-b" />
          <circle cx="134" cy="374" r="7" className="fs-lamp fs-lamp-c" />
        </g>

        {/* hose sweeping from the dispenser up to the nozzle */}
        <path
          d="M228 286 C 274 284, 244 186, 258 166"
          fill="none" stroke="#062d3a" strokeWidth="13" strokeLinecap="round"
        />
        <path
          d="M228 286 C 274 284, 244 186, 258 166"
          fill="none" stroke="#0d5f74" strokeWidth="7" strokeLinecap="round"
          className="fs-hose"
        />

        {/* nozzle, spout centred over the tank */}
        <g className="fs-nozzle">
          <rect x="252" y="148" width="66" height="31" rx="13" fill="#0d5f74" />
          <rect x="252" y="148" width="66" height="31" rx="13" fill="url(#fs-glass)" />
          <rect x="264" y="156" width="26" height="6" rx="3" fill="#ffffff" opacity="0.22" />
          <rect x="299" y="172" width="14" height="34" rx="6" fill="#ffca55" />
          <rect x="299" y="196" width="14" height="10" rx="4" fill="#ef8a24" />
        </g>

        {/* pouring stream, landing in the middle of the tank */}
        <rect x="303" y="204" width="6" height="42" rx="3" fill="url(#fs-stream)" className="fs-stream" />

        {/* tank */}
        <rect x="243" y="243" width="126" height="176" rx="20" fill="#04222c" opacity="0.55" />
        <g clipPath="url(#fs-tank)">
          <g className="fs-fill">
            <rect x="243" y="243" width="126" height="176" fill="url(#fs-fuel)" />
            <path
              className="fs-wave"
              d="M243 6 q 21 -9 42 0 t 42 0 t 42 0 t 42 0 t 42 0 v 40 H243 Z"
              fill="#ffe07a" opacity="0.85"
            />
          </g>
          {/* bubbles rising through the fuel */}
          <circle className="fs-bubble fs-bubble-a" cx="278" r="5" fill="#fff6d8" opacity="0.6" />
          <circle className="fs-bubble fs-bubble-b" cx="312" r="3.4" fill="#fff6d8" opacity="0.5" />
          <circle className="fs-bubble fs-bubble-c" cx="338" r="4.2" fill="#fff6d8" opacity="0.55" />
        </g>
        <rect
          x="243" y="243" width="126" height="176" rx="20"
          fill="none" stroke="#54f1c6" strokeOpacity="0.4" strokeWidth="1.5"
        />
        <rect x="243" y="243" width="126" height="176" rx="20" fill="url(#fs-glass)" />

        {/* verified stamp */}
        <g className="fs-stamp">
          <rect x="254" y="300" width="104" height="34" rx="17" fill="#04231f" opacity="0.78" />
          <circle cx="274" cy="317" r="9" fill="#4ef0b6" />
          <path d="M270 317 l3 3 l6 -7" fill="none" stroke="#04231f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="290" y="322" className="fs-stamp-text">ShDayVol</text>
        </g>
      </svg>

      {/* floating readouts */}
      <div className="fs-chip fs-chip-a"><b>T1–T4</b><span>read on device</span></div>
      <div className="fs-chip fs-chip-b"><b>{'<'}2s</b><span>scan → result</span></div>
    </div>
  )
}
