export type ThemeChoice = 'system' | 'light' | 'dark' | 'amoled'
export type WallpaperChoice = 'none' | 'fuel-aurora' | 'midnight-octane' | 'diesel-gold' | 'petrol-prism'
export type DensityChoice = 'comfortable' | 'compact'
export type AppPreferences = {
  theme: ThemeChoice
  wallpaper: WallpaperChoice
  reduceMotion: boolean
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
  density: 'comfortable',
  defaultMode: 'mixed',
  defaultHsdRate: '95.50',
  defaultMsRate: '102.01',
  defaultTesting: '',
  language: 'hinglish'
}

export const loadPreferences = (): AppPreferences => {
  try {
    const raw = localStorage.getItem('pump-book-preferences-v1')
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) as Partial<AppPreferences> } : defaultPreferences
  } catch { return defaultPreferences }
}
