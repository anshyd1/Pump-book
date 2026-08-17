import { useEffect, useRef, useState } from 'react'
import QrCode from './QrCode'
import { APP_VERSION, ARM64_URL, ARMV7_URL, REPO_URL, RELEASE_URL, SHARE_URL } from './qrCodes'

type Props = {
  onEnter: () => void
  onDismiss: () => void
}

const STATION = `${import.meta.env.BASE_URL}landing/station-neutral.webp`
const NOZZLE = `${import.meta.env.BASE_URL}landing/nozzle-neutral.webp`

/** Documented fixture pair — the same numbers the regression suite asserts. */
const LEDGER = [
  { tank: 'T1', open: '1248765.432', close: '1249178.182', diff: '412.750' },
  { tank: 'T2', open: '2506340.875', close: '2507529.500', diff: '1188.625' },
  { tank: 'T3', open: '987654.321', close: '987890.801', diff: '236.480' },
  { tank: 'T4', open: '4752880.640', close: '4753776.000', diff: '895.360' }
]

const CHAPTERS = [
  {
    n: '01',
    title: 'The slip comes off the printer',
    body: 'Thermal paper, four nozzle totalizers, numbers running to three decimals. Typing them by hand at the end of a twelve-hour shift is exactly where the money leaks.'
  },
  {
    n: '02',
    title: 'Point the camera once',
    body: 'Google ML Kit reads T1–T4 directly on the phone, with bounding boxes so the right number lands in the right row. No upload, no cloud key, no per-scan bill.'
  },
  {
    n: '03',
    title: 'The app checks its own work',
    body: 'Closing minus Opening must equal the day volume printed on that same slip. If it does not, Auto Fill, Save and Print are blocked — a safety hold, never a guess.'
  },
  {
    n: '04',
    title: 'The day closes clean',
    body: 'Rates, testing, and every payment mode — cash, PhonePe, Paytm, bank, fleet card, udhari, kharche — reconciled until the ledger balances. Then save, share or print.'
  }
]

const FEATURES = [
  { k: 'On-device OCR', v: 'ML Kit reads the totalizer with bounding boxes. Nothing leaves the phone.' },
  { k: 'ShDayVol gate', v: 'Every nozzle difference is proved against the slip’s own printed day volume.' },
  { k: 'Explicit shifts', v: 'You confirm Morning or Evening. One slip can never fill both columns.' },
  { k: 'Reconciliation', v: 'Eight payment modes matched against the day’s fuel sale until it balances.' },
  { k: 'History & export', v: 'Searchable local history, real .xlsx export, WhatsApp share, A4 print.' },
  { k: 'Encrypted backup', v: 'Password-protected AES-GCM files. No account, no analytics, ever.' }
]

/** Counts a number up once its section scrolls into view. */
function useCountUp(target: number, run: boolean, duration = 1600, reduced = false) {
  const [value, setValue] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced) { setValue(target); return }
    if (!run) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, run, duration, reduced])
  return value
}

export default function LandingPage({ onEnter, onDismiss }: Props) {
  const [reduced, setReduced] = useState(false)
  const [copied, setCopied] = useState(false)
  const [ledgerIn, setLedgerIn] = useState(false)
  const revealRefs = useRef<(HTMLElement | null)[]>([])
  const ledgerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(q.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])

  // Scroll reveal for every element tagged with the ref collector.
  useEffect(() => {
    const nodes = revealRefs.current.filter(Boolean) as HTMLElement[]
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach(n => n.classList.add('is-in'))
      setLedgerIn(true)
      return
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' })
    nodes.forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [reduced])

  // Ledger animates its own numbers when it arrives.
  useEffect(() => {
    const el = ledgerRef.current
    if (!el) return
    if (reduced || !('IntersectionObserver' in window)) { setLedgerIn(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setLedgerIn(true); io.disconnect() }
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  const total = useCountUp(265248.52, ledgerIn, 1900, reduced)
  const litres = useCountUp(2733.215, ledgerIn, 1900, reduced)

  const track = (i: number) => (n: HTMLElement | null) => { revealRefs.current[i] = n }

  const shareText = 'Pump Book — petrol pump daily closing. Scan the shift slip, it reads the totalizer and does the maths. Free and offline.'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { setCopied(false) }
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Pump Book', text: shareText, url: SHARE_URL }).catch(() => undefined)
    } else { void copyLink() }
  }

  const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const qty = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

  return (
    <div className={`ed${reduced ? ' is-still' : ''}`}>

      {/* ============================================ masthead */}
      <header className="ed-masthead">
        <span className="ed-logo">Pump&nbsp;Book</span>
        <nav className="ed-nav">
          <a href="#ed-story">The problem</a>
          <a href="#ed-proof">Proof</a>
          <a href="#ed-get">Get it</a>
        </nav>
        <button type="button" className="ed-skip" onClick={onDismiss}>Open app →</button>
      </header>

      {/* ============================================ split hero */}
      <section className="ed-hero">
        <figure className="ed-hero-pic">
          <span className="ed-pic-img" style={{ backgroundImage: `url(${STATION})` }} />
          <span className="ed-pic-veil" />
          <figcaption>
            <b>Gorakhpur</b>
            <span>Closing time, 20:40</span>
          </figcaption>
        </figure>

        <div className="ed-hero-copy">
          <span className="ed-rule" />
          <p className="ed-eyebrow">Pump Book · Edition {APP_VERSION}</p>
          <h1>
            <span className="ed-line"><span>Fuel counted.</span></span>
            <span className="ed-line"><em>Every rupee matched.</em></span>
          </h1>
          <p className="ed-hindi">हर लीटर दर्ज। हर रुपया Match.</p>
          <p className="ed-dek">
            A petrol-pump closing app built for the forecourt, not the office. It reads the thermal
            shift slip on device, pairs Morning with Evening, and <strong>refuses to show a total it
            cannot prove</strong> against the printed ShDayVol.
          </p>

          <dl className="ed-stats">
            <div><dt>&lt;2s</dt><dd>Scan to result</dd></div>
            <div><dt>100%</dt><dd>On device</dd></div>
            <div><dt>0</dt><dd>Cloud uploads</dd></div>
          </dl>

          <div className="ed-actions">
            <a className="ed-btn ed-btn-solid" href={ARM64_URL}>Download APK</a>
            <button type="button" className="ed-btn ed-btn-line" onClick={onEnter}>Start a closing</button>
          </div>
        </div>
      </section>

      {/* ============================================ ticker */}
      <div className="ed-ticker" aria-hidden="true">
        <div className="ed-ticker-track">
          {[0, 1].map(i => (
            <span key={i}>
              Offline first <i>·</i> ML Kit OCR <i>·</i> ShDayVol verified <i>·</i> AES-GCM backup
              <i>·</i> Excel export <i>·</i> No account <i>·</i> Built by Ansh <i>·</i>&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ============================================ story */}
      <section className="ed-story" id="ed-story">
        <div className="ed-story-head" ref={track(0)}>
          <span className="ed-rule dark" />
          <h2>Every evening,<br /><em>the same question.</em></h2>
          <p>Did the numbers actually add up — or did a misread digit just walk out of the till?</p>
        </div>

        <ol className="ed-chapters">
          {CHAPTERS.map((c, i) => (
            <li key={c.n} ref={track(1 + i)}>
              <span className="ed-chapter-n">{c.n}</span>
              <div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ============================================ proof / ledger */}
      <section className="ed-proof" id="ed-proof">
        <figure className="ed-proof-pic" ref={track(5)}>
          <span className="ed-pic-img" style={{ backgroundImage: `url(${NOZZLE})` }} />
          <span className="ed-pic-veil soft" />
        </figure>

        <div className="ed-proof-copy" ref={ledgerRef}>
          <span className="ed-rule" />
          <p className="ed-eyebrow light">A verified pair</p>
          <h2>The maths, shown<br />in full.</h2>
          <p className="ed-proof-lede">
            These are the documented validation figures from the test suite — the same four nozzles,
            checked against the printed day volume before a rupee is calculated.
          </p>

          <div className={`ed-ledger${ledgerIn ? ' is-in' : ''}`}>
            <div className="ed-ledger-head">
              <span>Tank</span><span>Opening</span><span>Closing</span><span>Sale</span>
            </div>
            {LEDGER.map((r, i) => (
              <div className="ed-ledger-row" key={r.tank} style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="ed-tank">{r.tank}</span>
                <span className="ed-mono dim">{r.open}</span>
                <span className="ed-mono dim">{r.close}</span>
                <span className="ed-mono ok">{r.diff}</span>
              </div>
            ))}
            <div className="ed-ledger-total">
              <div>
                <span>Verified volume</span>
                <b className="ed-mono">{qty.format(litres)} L</b>
              </div>
              <div className="right">
                <span>Final sale</span>
                <b className="ed-mono gold">₹{inr.format(total)}</b>
              </div>
            </div>
            <p className="ed-ledger-foot">
              <i /> Mode 2 · HSD ₹95.50 · MS ₹102.01 · testing 0 — all four nozzles match ShDayVol
            </p>
          </div>
        </div>
      </section>

      {/* ============================================ features */}
      <section className="ed-features">
        <div className="ed-feat-head" ref={track(6)}>
          <span className="ed-rule dark" />
          <h2>What ships in {APP_VERSION}</h2>
        </div>
        <div className="ed-feat-grid">
          {FEATURES.map((f, i) => (
            <article key={f.k} ref={track(7 + i)}>
              <span className="ed-feat-n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{f.k}</h3>
              <p>{f.v}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ============================================ get it */}
      <section className="ed-get" id="ed-get">
        <div className="ed-get-head" ref={track(13)}>
          <span className="ed-rule" />
          <h2>Get Pump Book</h2>
          <p>Point a camera at a code, or tap the link beneath it. Most phones made after 2017 are ARM64.</p>
        </div>

        <div className="ed-get-grid">
          <article ref={track(14)}>
            <p className="ed-get-tag">Recommended</p>
            <h3>Android ARM64</h3>
            <QrCode target="arm64" size={158} tone="#111110" />
            <a href={ARM64_URL}>Download · 17.4 MB</a>
            <span className="ed-mono tiny">arm64-v8a</span>
          </article>
          <article ref={track(15)}>
            <p className="ed-get-tag">Older phones</p>
            <h3>Android ARMv7</h3>
            <QrCode target="armv7" size={158} tone="#111110" />
            <a href={ARMV7_URL}>Download · 13.1 MB</a>
            <span className="ed-mono tiny">armeabi-v7a</span>
          </article>
          <article ref={track(16)}>
            <p className="ed-get-tag">Share it</p>
            <h3>Send to a friend</h3>
            <QrCode target="share" size={158} tone="#111110" />
            <a href={SHARE_URL}>Open download page</a>
            <span className="ed-mono tiny">pumpbook.vercel.app</span>
          </article>
        </div>

        <p className="ed-note" ref={track(17)}>
          <b>Installing an APK?</b> Android asks you to allow installs from your browser — normal outside
          the Play Store. <b>Upgrading from 4.1.3?</b> Back up, uninstall, install {APP_VERSION}, restore.
          From {APP_VERSION} onward, updates arrive in <b>Settings → App updates</b>.
        </p>
      </section>

      {/* ============================================ share */}
      <section className="ed-share">
        <div className="ed-share-inner" ref={track(18)}>
          <div>
            <span className="ed-rule" />
            <h2>Know another<br />pump owner?</h2>
            <p>Send the link, or let them scan it straight off your screen.</p>
            <div className="ed-copy-row">
              <input value={SHARE_URL} readOnly aria-label="Pump Book link"
                onFocus={e => e.currentTarget.select()} />
              <button type="button" onClick={() => void copyLink()}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className="ed-chips">
              <a className="ed-chip wa" target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${SHARE_URL}`)}`}>WhatsApp</a>
              <a className="ed-chip tg" target="_blank" rel="noopener noreferrer"
                href={`https://t.me/share/url?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(shareText)}`}>Telegram</a>
              <button type="button" className="ed-chip sys" onClick={() => void nativeShare()}>More…</button>
            </div>
          </div>
          <div className="ed-share-qr">
            <QrCode target="share" size={190} tone="#111110" />
            <span className="ed-mono tiny">anshyd1.github.io/Pump-book</span>
          </div>
        </div>
      </section>

      {/* ============================================ colophon */}
      <footer className="ed-foot">
        <div className="ed-foot-grid">
          <div>
            <span className="ed-logo light">Pump&nbsp;Book</span>
            <p>Fuel counted. Every rupee matched.</p>
          </div>
          <div>
            <b>Verify</b>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
            <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer">Release {APP_VERSION}</a>
          </div>
          <div>
            <b>Checksums</b>
            <span className="ed-mono tiny">b196babf…c55c0703 arm64</span>
            <span className="ed-mono tiny">339fad97…01ca3968e armv7</span>
          </div>
          <div>
            <b>Runs</b>
            <span>Offline · no account</span>
            <span>Android 6.0+ · any browser</span>
          </div>
        </div>
        <div className="ed-foot-rule" />
        <div className="ed-colophon">
          <span>Designed &amp; built by Ansh</span>
          <button type="button" className="ed-btn ed-btn-solid small" onClick={onEnter}>Open Pump Book →</button>
        </div>
      </footer>
    </div>
  )
}
