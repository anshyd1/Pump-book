export type ThemeChoice = 'system' | 'light' | 'dark' | 'amoled'
export type WallpaperChoice = 'none' | 'fuel-aurora' | 'midnight-octane' | 'diesel-gold' | 'petrol-prism'
export type DensityChoice = 'comfortable' | 'compact'
export type AppPreferences = {
  theme: ThemeChoice
  wallpaper: WallpaperChoice
  reduceMotion: boolean
  autoUpdateCheck: boolean
  density: DensityChoice
  defaultMode: 'allHsd' | 'mixed'
  defaultHsdRate: string
  defaultMsRate: string
  defaultTesting: string
  language: 'hinglish' | 'english'
}

export const defaultPreferences: AppPreferences = {
  theme: 'system',
  wallpaper: 'fuel-aurora',
  reduceMotion: false,
  autoUpdateCheck: true,
  density: 'comfortable',
  defaultMode: 'mixed',
  defaultHsdRate: '95.50',
  defaultMsRate: '102.01',
  defaultTesting: '',
  language: 'hinglish'
}

/** Wallpapers that ship as static files in public/wallpapers. */
export const WALLPAPER_FILES: Exclude<WallpaperChoice, 'none'>[] = [
  'fuel-aurora',
  'midnight-octane',
  'diesel-gold',
  'petrol-prism'
]

/**
 * Publishes one CSS variable per wallpaper, resolved against the deployment's
 * base URL.
 *
 * The stylesheet cannot hard-code these paths: it is bundled into /assets/, so a
 * relative url() would resolve one directory too deep, and an absolute /path
 * breaks whenever the app is not served from the domain root (GitHub Pages
 * serves it from /Pump-book/, and Capacitor from a file-backed origin).
 * Resolving here — where import.meta.env.BASE_URL is known — keeps every target
 * correct.
 */
export const applyWallpaperUrls = (): void => {
  const root = document.documentElement
  // BASE_URL is './' for this build, and a relative url() inside a CSS variable
  // is resolved against the stylesheet (…/assets/), not the document. Resolving
  // to an absolute URL here removes that ambiguity on every target.
  const base = new URL(import.meta.env.BASE_URL || './', document.baseURI).href
  WALLPAPER_FILES.forEach(name => {
    const href = new URL(`wallpapers/${name}.webp`, base).href
    root.style.setProperty(`--wp-${name}`, `url("${href}")`)
  })
}

export const loadPreferences = (): AppPreferences => {
  try {
    const raw = localStorage.getItem('pump-book-preferences-v1')
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) as Partial<AppPreferences> } : defaultPreferences
  } catch { return defaultPreferences }
}
