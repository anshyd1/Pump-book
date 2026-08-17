import type { UpdateInfo } from './appUpdater'

type Props = {
  version: string
  info: UpdateInfo | null
  busy: boolean
  message: string
  error: string
  autoCheck: boolean
  onAutoCheck: (value: boolean) => void
  onCheck: () => void
  onInstall: () => void
  onRelease: () => void
}

export default function AppUpdateCard(props: Props) {
  const updateReady = Boolean(props.info?.updateAvailable)
  return <section className={`card update-card ${updateReady ? 'has-update' : ''}`}>
    <div className="update-mark"><span>⇧</span><i/></div>
    <div className="update-copy">
      <p className="eyebrow">APP UPDATE</p>
      <h2>{!props.info ? 'App updates' : updateReady ? `Pump Book ${props.info.latestVersion} ready` : 'Pump Book is up to date'}</h2>
      <p>{props.info?.platform === 'pwa' ? 'PWA files service worker से automatically refresh होते हैं।' : 'GitHub release से सही phone architecture का APK app के अंदर download होगा। Android final install confirmation दिखाएगा।'}</p>
      <div className="update-meta"><span>Installed <b>v{props.info?.currentVersion || props.version}</b></span><span>Channel <b>GitHub stable</b></span>{props.info?.abi && <span>ABI <b>{props.info.abi}</b></span>}</div>
      {props.message && <div className="update-message">✓ {props.message}</div>}
      {props.error && <div className="update-error">{props.error}</div>}
      <div className="update-actions">
        <button className={updateReady ? 'update-primary' : ''} disabled={props.busy} onClick={updateReady ? props.onInstall : props.onCheck}>{props.busy ? <><i/>Checking…</> : updateReady ? 'Download & install update' : 'Check for updates'}</button>
        {props.info?.releaseUrl && <button disabled={props.busy} onClick={props.onRelease}>Release notes</button>}
      </div>
    </div>
    <label className="update-auto"><span><b>Auto-check</b><small>App खुलने पर</small></span><input type="checkbox" checked={props.autoCheck} onChange={event => props.onAutoCheck(event.target.checked)}/><i/></label>
  </section>
}
