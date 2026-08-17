import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './landing.css'
import { applyWallpaperUrls } from './preferences'

// Resolve wallpaper URLs before first paint so the picker and the background
// layer never render against an unset variable.
applyWallpaperUrls()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined)
  })
}
