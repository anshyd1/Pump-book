import { useEffect, useRef, useState } from 'react'
import FuelStage from './FuelStage'
import QrCode from './QrCode'
import BrandLogo from './BrandLogo'
import { APP_VERSION, ARM64_URL, ARMV7_URL, PWA_URL, REPO_URL, RELEASE_URL } from './qrCodes'

type Props = {
  onEnter: () => void
  onDismiss: () => void
}

const FEATURES = [
  {
    icon: '📷',
    tone: 'a',
    title: 'On-device totalizer OCR',
    body: 'Google ML Kit reads T1–T4 straight off the shift slip with bounding boxes. No cloud key, no per-scan billing, no image ever leaves the phone.'
  },
  {
    icon: '🛡️',
    tone: 'b',
    title: 'ShDayVol safety gate',
    body: "Closing − Opening is checked against the slip's own printed day volume. A misread digit blocks Auto Fill, Save and Print instead of quietly costing you money."
  },
  {
    icon: '🌅',
    tone: 'c',
    title: 'Explicit Morning / Evening',
    body: 'You confirm which shift each scan belongs to. One slip can never silently fill both columns, and the clock is never used to guess.'
  },
  {
    icon: '💳',
    tone: 'd',
    title: 'Payment reconciliation',
    body: 'Cash, PhonePe, Paytm, bank, fleet card, udhari and kharche — matched against the day’s fuel sale until the ledger balances.'
  },
  {
    icon: '📊',
    tone: 'e',
    title: 'History, Excel & print',
    body: 'Searchable local history, real multi-sheet .xlsx export, WhatsApp share and a one-page A4 landscape day report.'
  },
  {
    icon: '🔒',
    tone: 'f',
    title: 'Encrypted backup',
    body: 'Password-protected AES-GCM .pumpbook files. No account, no analytics, no sign-up — the data stays yours.'
  }
]

const STEPS = [
  { n: '01', title: 'Scan Morning slip', body: 'Point the camera at the opening shift totalizer. ML Kit lifts all four nozzle readings.' },
  { n: '02', title: 'Scan Evening slip', body: 'Same for the closing shift. You explicitly confirm which column each scan belongs to.' },
  { n: '03', title: 'Verified automatically', body: 'Every nozzle difference is matched against the printed ShDayVol before a rupee is calculated.' },
  { n: '04', title: 'Close the day', body: 'Enter rates and payments, then save, share on WhatsApp, export Excel or print the report.' }
]

export default function LandingPage({ onEnter, onDismiss }: Props) {
  const [copied, setCopied] = useState(false)
  const [reduced, setReduced] = useState(false)
  const revealRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const nodes = revealRefs.current.filter(Boolean) as HTMLElement[]
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach(node => node.classList.add('is-in'))
      return
    }
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [reduced])

  const track = (index: number) => (node: HTMLElement | null) => { revealRefs.current[index] = node }

  const shareText = 'Pump Book — petrol pump daily closing. Scan the shift slip, it reads the totalizer and does the maths. Free and offline.'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PWA_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Pump Book', text: shareText, url: PWA_URL }).catch(() => undefined)
    } else {
      void copyLink()
    }
  }

  return (
    <div className="landing">
      {/* ------------------------------------------------ hero */}
      <header className="landing-hero">
        <div className="landing-aurora" aria-hidden="true">
          <span className="aurora-blob blob-1" />
          <span className="aurora-blob blob-2" />
          <span className="aurora-blob blob-3" />
          <span className="aurora-grid" />
        </div>

        <nav className="landing-nav">
          <span className="landing-brand">
            <BrandLogo compact animated={false} />
            <span><b>Pump Book</b><small>SMART DAILY CLOSING</small></span>
          </span>
          <div className="landing-nav-links">
            <a href="#landing-get">Download</a>
            <a href="#landing-features">Features</a>
            <a href="#landing-flow">How it works</a>
            <button type="button" className="landing-skip" onClick={onDismiss}>Open app →</button>
          </div>
        </nav>

        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-pill"><i />Version {APP_VERSION} · Free · No account</span>
            <h1>Fuel counted.<br /><em>Every rupee matched.</em></h1>
            <p className="landing-hindi">हर लीटर दर्ज। हर रुपया Match.</p>
            <p className="landing-sub">
              Scan the IndianOil shift totalizer slip. Pump Book reads T1–T4 on device, pairs Morning with
              Evening, verifies every nozzle against the printed ShDayVol and closes the day with payments
              reconciled — completely offline.
            </p>
            <div className="landing-cta">
              <a className="landing-btn primary" href="#landing-get">
                <span>⬇</span> Get the app
              </a>
              <button type="button" className="landing-btn ghost" onClick={onEnter}>
                <span>▶</span> Start a closing
              </button>
            </div>
            <dl className="landing-stats">
              <div><dt>&lt;2s</dt><dd>Scan to result</dd></div>
              <div><dt>100%</dt><dd>On-device OCR</dd></div>
              <div><dt>0</dt><dd>Cloud uploads</dd></div>
              <div><dt>13 MB</dt><dd>APK size</dd></div>
            </dl>
          </div>

          <FuelStage />
        </div>

        <div className="landing-marquee" aria-hidden="true">
          <div className="landing-marquee-track">
            {Array.from({ length: 2 }).map((_, copy) => (
              <span key={copy}>
                OFFLINE FIRST <i>◆</i> ML KIT OCR <i>◆</i> ShDayVol VERIFIED <i>◆</i> AES-GCM BACKUP
                <i>◆</i> EXCEL EXPORT <i>◆</i> NO ACCOUNT <i>◆</i> BUILT BY ANSH <i>◆</i>&nbsp;
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ download + QR */}
      <section className="landing-section landing-get" id="landing-get">
        <div className="landing-head" ref={track(0)}>
          <p className="landing-eyebrow">Scan · tap · done</p>
          <h2>Get Pump Book in seconds</h2>
          <p className="landing-lede">
            Point a phone camera at a code, or tap the button under it. Not sure which APK?
            Almost every phone made after 2017 is <b>ARM64</b>.
          </p>
        </div>

        <div className="landing-qr-grid" ref={track(1)}>
          <article className="landing-qr-card tone-a">
            <p className="landing-qr-tag">Recommended</p>
            <h3>Android ARM64</h3>
            <p className="landing-qr-body">Bundled ML Kit OCR. Fastest scanning, fully offline.</p>
            <QrCode target="arm64" size={168} label="Scan to download" />
            <a className="landing-qr-btn" href={ARM64_URL}>Download · 17.4 MB</a>
            <p className="landing-qr-meta">arm64-v8a · v{APP_VERSION}</p>
          </article>

          <article className="landing-qr-card tone-b">
            <p className="landing-qr-tag">Older phones</p>
            <h3>Android ARMv7</h3>
            <p className="landing-qr-body">For 32-bit devices. Same features, smaller build.</p>
            <QrCode target="armv7" size={168} label="Scan to download" />
            <a className="landing-qr-btn" href={ARMV7_URL}>Download · 13.1 MB</a>
            <p className="landing-qr-meta">armeabi-v7a · v{APP_VERSION}</p>
          </article>

          <article className="landing-qr-card tone-c">
            <p className="landing-qr-tag">No install</p>
            <h3>Web app</h3>
            <p className="landing-qr-body">Runs in any browser. Add to Home Screen for offline use.</p>
            <QrCode target="pwa" size={168} label="Scan to open" />
            <a className="landing-qr-btn" href={PWA_URL}>Open web app</a>
            <p className="landing-qr-meta">Tesseract OCR fallback</p>
          </article>
        </div>

        <p className="landing-note" ref={track(2)}>
          <b>Installing an APK?</b> Android will ask you to allow installs from your browser — that is normal
          outside the Play Store. <b>Upgrading from 4.1.3?</b> Back up first, uninstall 4.1.3, install {APP_VERSION},
          then restore; the old test key could not be retained. From {APP_VERSION} onward, updates install
          normally from <b>Settings → App updates</b>.
        </p>
      </section>

      {/* ------------------------------------------------ features */}
      <section className="landing-section landing-features" id="landing-features">
        <div className="landing-head" ref={track(3)}>
          <p className="landing-eyebrow">Built for the pump, not the office</p>
          <h2>Everything in one closing</h2>
          <p className="landing-lede">Every feature below ships in {APP_VERSION} today.</p>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map((feature, index) => (
            <article className={`landing-feature tone-${feature.tone}`} key={feature.title} ref={track(4 + index)}>
              <i>{feature.icon}</i>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ flow */}
      <section className="landing-section landing-flow" id="landing-flow">
        <div className="landing-head" ref={track(11)}>
          <p className="landing-eyebrow">Four steps, twice a day</p>
          <h2>How a closing works</h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map((step, index) => (
            <li key={step.n} ref={track(12 + index)}>
              <span className="landing-step-n">{step.n}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------ share */}
      <section className="landing-section landing-share">
        <div className="landing-head" ref={track(16)}>
          <p className="landing-eyebrow">Know another pump owner?</p>
          <h2>Share Pump Book</h2>
          <p className="landing-lede">Send the link, or let them scan the code right off your screen.</p>
        </div>

        <div className="landing-share-grid" ref={track(17)}>
          <div className="landing-share-card">
            <h3>Send a link</h3>
            <p>Opens the web app instantly — nothing to install.</p>
            <div className="landing-copy-row">
              <input value={PWA_URL} readOnly aria-label="Pump Book link" onFocus={event => event.currentTarget.select()} />
              <button type="button" onClick={() => void copyLink()}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <div className="landing-chips">
              <a
                className="landing-chip wa"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${PWA_URL}`)}`}
              >WhatsApp</a>
              <a
                className="landing-chip tg"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://t.me/share/url?url=${encodeURIComponent(PWA_URL)}&text=${encodeURIComponent(shareText)}`}
              >Telegram</a>
              <button type="button" className="landing-chip sys" onClick={() => void nativeShare()}>More…</button>
            </div>
          </div>

          <div className="landing-share-card center">
            <h3>Let them scan</h3>
            <p>Hold up your phone, project it, or print it.</p>
            <QrCode target="pwa" size={180} />
            <p className="landing-qr-meta">anshyd1.github.io/Pump-book</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ trust */}
      <section className="landing-section landing-trust">
        <div className="landing-head" ref={track(18)}>
          <p className="landing-eyebrow">Trust, but verify</p>
          <h2>Open source &amp; checksummed</h2>
          <p className="landing-lede">Read every line, or verify your download with <code>sha256sum</code>.</p>
        </div>
        <div className="landing-sums" ref={track(19)}>
          <div><b>ARM64 APK</b><code>b196babf56d576abb32213dd21ed84af05d747c75931c4ea7b44cceec55c0703</code></div>
          <div><b>ARMv7 APK</b><code>339fad97740eaf3143040caffdc2a4f4d8ca17d50c534bb1b2292b801ca3968e</code></div>
          <div><b>Source zip</b><code>97f15dd4a412840073ab9cd15374ad6785adfcbdfe4f27d68c0fbd87822efc5e</code></div>
        </div>
        <div className="landing-trust-cta">
          <a className="landing-btn primary" href={REPO_URL} target="_blank" rel="noopener noreferrer">★ View source</a>
          <a className="landing-btn ghost dark" href={RELEASE_URL} target="_blank" rel="noopener noreferrer">Release notes</a>
        </div>
      </section>

      <footer className="landing-foot">
        <span className="landing-brand">
          <BrandLogo compact animated={false} />
          <span><b>Pump Book</b><small>FUEL COUNTED. EVERY RUPEE MATCHED.</small></span>
        </span>
        <p>Runs offline · No account · No analytics · Android 6.0+ (minSdk 23)</p>
        <p className="landing-by">Designed &amp; built by Ansh</p>
        <button type="button" className="landing-btn primary" onClick={onEnter}>Open Pump Book →</button>
      </footer>
    </div>
  )
}
