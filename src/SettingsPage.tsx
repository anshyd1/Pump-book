import { useState } from 'react'
import BrandLogo from './BrandLogo'
import QrCode from './QrCode'
import { PWA_URL } from './qrCodes'
import AppUpdateCard from './AppUpdateCard'
import type { UpdateInfo } from './appUpdater'
import type { AppPreferences, ThemeChoice, WallpaperChoice } from './preferences'

type Props = {
  preferences: AppPreferences
  onChange: (next: AppPreferences) => void
  onClearDraft: () => void
  onClearHistory: () => void
  historyCount: number
  version: string
  updateInfo: UpdateInfo | null
  updateBusy: boolean
  updateMessage: string
  updateError: string
  onCheckUpdate: () => void
  onInstallUpdate: () => void
  onOpenRelease: () => void
  onOpenWelcome: () => void
}

const themes: { id: ThemeChoice; label: string; hint: string }[] = [
  { id: 'system', label: 'System', hint: 'Phone setting' },
  { id: 'light', label: 'Light', hint: 'Clean ledger' },
  { id: 'dark', label: 'Dark', hint: 'Low glare' },
  { id: 'amoled', label: 'AMOLED', hint: 'Pure black' }
]
const SHARE_TEXT = 'Pump Book — petrol pump daily closing. Scan the shift slip, it reads the totalizer and does the maths. Free and offline.'

const wallpapers: { id: WallpaperChoice; label: string; hint: string }[] = [
  { id: 'fuel-aurora', label: 'Fuel Aurora', hint: 'Teal liquid glass' },
  { id: 'midnight-octane', label: 'Midnight Octane', hint: 'Navy neon fuel' },
  { id: 'diesel-gold', label: 'Diesel Gold', hint: 'Charcoal & amber' },
  { id: 'petrol-prism', label: 'Petrol Prism', hint: 'Bright fluid glass' },
  { id: 'none', label: 'Clean Ledger', hint: 'No wallpaper' }
]

export default function SettingsPage({ preferences, onChange, onClearDraft, onClearHistory, historyCount, version, updateInfo, updateBusy, updateMessage, updateError, onCheckUpdate, onInstallUpdate, onOpenRelease, onOpenWelcome }: Props) {
  const [copied, setCopied] = useState(false)
  const patch = (next: Partial<AppPreferences>) => onChange({ ...preferences, ...next })
  return <div className="page-stack settings-page">
    <section className="page-hero compact-hero">
      <div><span className="page-kicker">PERSONALISE YOUR LEDGER</span><h1>App settings</h1><p>Theme, wallpaper और daily defaults—सब offline और इसी device पर।</p></div>
      <BrandLogo compact/>
    </section>

    <AppUpdateCard
      version={version} info={updateInfo} busy={updateBusy} message={updateMessage} error={updateError}
      autoCheck={preferences.autoUpdateCheck} onAutoCheck={value => patch({ autoUpdateCheck: value })}
      onCheck={onCheckUpdate} onInstall={onInstallUpdate} onRelease={onOpenRelease}
    />

    <section className="card settings-section">
      <div className="section-head"><div><p className="eyebrow">Appearance</p><h2>Theme</h2></div><span className="soft-badge">Instant preview</span></div>
      <div className="theme-picker">{themes.map(theme => <button key={theme.id} className={preferences.theme === theme.id ? 'active' : ''} onClick={() => patch({ theme: theme.id })}><i className={`theme-dot ${theme.id}`}/><b>{theme.label}</b><small>{theme.hint}</small></button>)}</div>
      <div className="setting-toggles">
        <label><span><b>Reduce motion</b><small>Splash और liquid animations कम करें</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={event => patch({ reduceMotion: event.target.checked })}/><i/></label>
        <label><span><b>Compact layout</b><small>एक screen पर ज्यादा data</small></span><input type="checkbox" checked={preferences.density === 'compact'} onChange={event => patch({ density: event.target.checked ? 'compact' : 'comfortable' })}/><i/></label>
      </div>
    </section>

    <section className="card settings-section">
      <div className="section-head"><div><p className="eyebrow">AI ART · OFFLINE PACK</p><h2>Fuel wallpapers</h2><p className="section-sub">App में bundled—internet की जरूरत नहीं</p></div></div>
      <div className="wallpaper-picker">{wallpapers.map(wallpaper => <button key={wallpaper.id} className={`${preferences.wallpaper === wallpaper.id ? 'active' : ''} wallpaper-${wallpaper.id}`} onClick={() => patch({ wallpaper: wallpaper.id })}><span/><b>{wallpaper.label}</b><small>{wallpaper.hint}</small><i>✓</i></button>)}</div>
    </section>

    <section className="card settings-section">
      <div className="section-head"><div><p className="eyebrow">Daily defaults</p><h2>Rates &amp; workflow</h2></div></div>
      <div className="settings-form">
        <label><span>Default mode</span><select value={preferences.defaultMode} onChange={event => patch({ defaultMode: event.target.value as AppPreferences['defaultMode'] })}><option value="mixed">Mode 2 · MS / HSD / MS / HSD</option><option value="allHsd">Mode 1 · All HSD</option></select></label>
        <label><span>HSD rate ₹/L</span><input inputMode="decimal" value={preferences.defaultHsdRate} onChange={event => patch({ defaultHsdRate: event.target.value })}/></label>
        <label><span>MS rate ₹/L</span><input inputMode="decimal" value={preferences.defaultMsRate} onChange={event => patch({ defaultMsRate: event.target.value })}/></label>
        <label><span>Default testing L</span><input inputMode="decimal" value={preferences.defaultTesting} placeholder="Blank / 0.000" onChange={event => patch({ defaultTesting: event.target.value })}/></label>
      </div>
      <p className="settings-note">OCR safety, Closing ≥ Opening और ShDayVol verification हमेशा ON रहेंगे।</p>
    </section>

    <section className="card settings-section data-danger-zone">
      <div className="section-head"><div><p className="eyebrow">Device data</p><h2>Reset controls</h2></div><span className="soft-badge">{historyCount} saved days</span></div>
      <div className="danger-actions">
        <button onClick={onClearDraft}><b>Clear current draft</b><small>Readings, scan evidence और payments</small></button>
        <button onClick={onClearHistory}><b>Delete saved history</b><small>Backup पहले बना लें</small></button>
      </div>
    </section>

    <section className="card settings-section">
      <div className="section-head"><div><p className="eyebrow">Spread the word</p><h2>Share Pump Book</h2><p className="section-sub">सामने वाले को बस ये code scan करने दें—कुछ भी install नहीं</p></div><span className="soft-badge">Works offline</span></div>

      <div className="share-qr-row">
        <div className="share-qr-card">
          <QrCode target="pwa" size={150} label="Web app — कुछ install नहीं"/>
        </div>
        <div className="share-qr-card">
          <QrCode target="arm64" size={150} label="Android APK — ARM64"/>
        </div>
      </div>

      <div className="share-link-row">
        <input readOnly value={PWA_URL} aria-label="Pump Book link" onFocus={event => event.currentTarget.select()}/>
        <button type="button" className={copied ? 'is-copied' : ''} onClick={() => {
          navigator.clipboard.writeText(PWA_URL).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          }).catch(() => undefined)
        }}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>

      <div className="share-chip-row">
        <a className="share-chip wa" target="_blank" rel="noopener noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${PWA_URL}`)}`}>WhatsApp</a>
        <a className="share-chip tg" target="_blank" rel="noopener noreferrer"
          href={`https://t.me/share/url?url=${encodeURIComponent(PWA_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`}>Telegram</a>
        <button type="button" className="share-chip sys" onClick={() => {
          if (navigator.share) {
            void navigator.share({ title: 'Pump Book', text: SHARE_TEXT, url: PWA_URL }).catch(() => undefined)
          } else {
            void navigator.clipboard.writeText(`${SHARE_TEXT} ${PWA_URL}`).catch(() => undefined)
          }
        }}>More…</button>
        <button type="button" className="share-chip tour" onClick={onOpenWelcome}>Welcome page ↗</button>
      </div>
    </section>

    <section className="about-card">
      <BrandLogo/><div><span>PUMP BOOK</span><h2>Fuel counted.<br/>Every rupee matched.</h2><p>Private, offline-first petrol pump daily closing.</p><b>Designed &amp; built by Ansh</b><small>Version {version}</small></div>
    </section>
  </div>
}
