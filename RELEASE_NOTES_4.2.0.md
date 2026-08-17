# Pump Book 4.2.0 — Liquid dashboard, dedicated history and OCR safety

## Critical calculation safety

- Adds an independent per-nozzle invariant: `Closing − Opening` must match the Evening shift report's printed `ShDayVol` within tolerance.
- Blocks Auto Fill when the proposed pair conflicts with `ShDayVol`.
- Blocks Final Sale, History Save and Print while any reading is missing, negative or mismatched.
- Shows detected and printed values directly on the affected nozzle card.
- Restricts text fallback to the CumVolume label row/immediate value row so it cannot wander into `ShMTHVol`, `ShMTHSale` or `CumSale`.
- Persists Evening `ShDayVol` evidence with the current draft and safely migrates older drafts.

## New app experience

- New Pump Book fuel-drop, ledger and gauge logo.
- Short liquid paint-swipe launch animation with Reduce Motion support.
- Premium Home dashboard with today's progress, quick actions and recent closings.
- Dedicated Closing, History and Settings pages.
- Mobile bottom navigation and hamburger drawer.
- “Fuel counted. Every rupee matched.” and “by Ansh” identity.

## Themes and wallpapers

- System, Light, Dark and AMOLED themes.
- Comfortable and Compact layout density.
- Four locally bundled, compressed AI-designed wallpapers:
  - Fuel Aurora
  - Midnight Octane
  - Diesel Gold
  - Petrol Prism
- Clean Ledger option with no wallpaper.
- Default mode, HSD/MS rates and testing quantity preferences.

## History and data

- Separate searchable History/Data Center page.
- Saved record overview with Matched/Needs Check counts.
- Existing local auto-save, Excel, share, print and AES-GCM backup/restore preserved.
- Verified-current-day gate prevents unsafe history records.

## Branding and documentation

- Rebuilt PWA icons, Android launcher icons and Android splash artwork.
- Updated manifest shortcuts for Closing and History.
- Service-worker cache bumped to `pump-book-v24` and wallpapers pre-cached.
- README rebuilt with banner, release links, wallpaper gallery, architecture, formulas, validation pair and privacy documentation.

## Validation

- Ten TypeScript regression tests pass and cover structured association, field theft, pairing, negative totals and the reported huge-positive T1 failure.
- Production TypeScript/Vite build passes.
- Android `testDebugUnitTest assembleDebug` passes using JDK 21 and Android SDK 35.
- APK architecture checks confirm one ABI per build.
- Both APKs verify with signature schemes v1 and v2.

```text
f842a34dde9ea1f0e3662376ecac75f50b972e663cee82eca5c238c26770b09a  Pump-Book-4.2.0-arm64-debug.apk
2d3eeaf00ad55640e78d8efbb56a458271a063fcb14e9abb9ad120a6dc92ae5d  Pump-Book-4.2.0-armv7-debug.apk
```

## One-time test-build signing transition

The ephemeral debug key used for the published 4.1.3 test APK was deleted during the requested workspace cleanup and cannot be reconstructed from an APK. Android may therefore reject an in-place update. Before uninstalling 4.1.3, create a `.pumpbook` backup; then install 4.2.0 and restore it. Production deployments should use a separately secured long-lived release key.
