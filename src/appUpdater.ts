import { Capacitor, registerPlugin } from '@capacitor/core'

export type UpdateInfo = {
  currentVersion: string
  latestVersion: string
  tag: string
  updateAvailable: boolean
  abi: string
  assetName: string
  downloadUrl: string
  expectedSha256: string
  releaseUrl: string
  notes: string
  publishedAt: string
  platform: 'android' | 'pwa'
}
export type InstallResult = { permissionRequired?: boolean; installerLaunched?: boolean; message?: string; sha256?: string; sizeBytes?: number }

interface AppUpdaterPlugin {
  currentVersion(): Promise<{ version: string; abi: string; canInstallPackages: boolean }>
  checkForUpdate(): Promise<Omit<UpdateInfo, 'platform'>>
  downloadAndInstall(options: Pick<UpdateInfo, 'downloadUrl' | 'assetName' | 'expectedSha256'>): Promise<InstallResult>
  openReleasePage(options: { releaseUrl: string }): Promise<void>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')
export const nativeUpdaterAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const compareVersions = (left: string, right: string) => {
  const a = left.replace(/^v/i, '').split(/[.-]/).map(value => Number.parseInt(value, 10) || 0)
  const b = right.replace(/^v/i, '').split(/[.-]/).map(value => Number.parseInt(value, 10) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0)
  }
  return 0
}

export async function checkForAppUpdate(currentVersion: string): Promise<UpdateInfo> {
  if (nativeUpdaterAvailable()) return { ...await AppUpdater.checkForUpdate(), platform: 'android' }
  // PWA assets are updated by the service worker. The release check is only a
  // status display; it never downloads an Android APK in a browser.
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  await registration?.update().catch(() => undefined)
  const response = await fetch('https://api.github.com/repos/anshyd1/Pump-book/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
  const release = await response.json() as { tag_name?: string; html_url?: string; body?: string; published_at?: string }
  const latestVersion = (release.tag_name ?? currentVersion).replace(/^v/i, '')
  return {
    currentVersion, latestVersion, tag: release.tag_name ?? '',
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    abi: 'web', assetName: '', downloadUrl: '', expectedSha256: '',
    releaseUrl: release.html_url ?? 'https://github.com/anshyd1/Pump-book/releases/latest',
    notes: release.body ?? '', publishedAt: release.published_at ?? '', platform: 'pwa'
  }
}

export const installAppUpdate = (update: UpdateInfo): Promise<InstallResult> => {
  if (!nativeUpdaterAvailable()) return Promise.resolve({ message: 'PWA updates automatically after reload.' })
  return AppUpdater.downloadAndInstall({
    downloadUrl: update.downloadUrl,
    assetName: update.assetName,
    expectedSha256: update.expectedSha256
  })
}

export const openUpdateRelease = (releaseUrl: string) => {
  if (nativeUpdaterAvailable()) return AppUpdater.openReleasePage({ releaseUrl })
  window.open(releaseUrl, '_blank', 'noopener,noreferrer')
  return Promise.resolve()
}
