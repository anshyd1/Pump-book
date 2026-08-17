import { useEffect, useState } from 'react'
import BrandLogo from './BrandLogo'

type Props = { reduceMotion: boolean }

export default function IntroSplash({ reduceMotion }: Props) {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem('pump-book-intro-v1'))
  useEffect(() => {
    if (!visible) return
    sessionStorage.setItem('pump-book-intro-v1', '1')
    const timer = window.setTimeout(() => setVisible(false), reduceMotion ? 120 : 1450)
    return () => window.clearTimeout(timer)
  }, [reduceMotion, visible])
  if (!visible) return null
  return <div className={`intro-splash ${reduceMotion ? 'reduced' : ''}`} role="status" aria-label="Opening Pump Book">
    <div className="intro-paint one"/><div className="intro-paint two"/>
    <div className="intro-mark"><BrandLogo/><div className="intro-wordmark"><span>SMART DAILY CLOSING</span><strong>Pump <em>Book</em></strong><small>Fuel counted. Every rupee matched.</small><b>by Ansh</b></div></div>
    <div className="intro-progress"><i/></div>
  </div>
}
