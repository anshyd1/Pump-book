# Pump Book 4.2.1 — In-app updater, OCR safety and liquid dashboard

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

## In-app Android updater

- Checks the latest `anshyd1/Pump-book` GitHub release in the background.
- Selects the correct ARM64 or ARMv7 asset from the device ABI.
- Downloads inside the app, verifies `SHA256SUMS.txt` when present and opens Android’s official package installer.
- Restricts downloads to this repository’s HTTPS release path and enforces an 80 MB size ceiling.
- Android still requires final user confirmation and same-certificate signing; no root/silent install is attempted.
- PWA builds ask the service worker to refresh and continue updating automatically.
- Settings includes manual Check, Download & Install, release notes and an Auto-check toggle.

## Branding and documentation

- Rebuilt PWA icons, Android launcher icons and Android splash artwork.
- Updated manifest shortcuts for Closing and History.
- Service-worker cache bumped to `pump-book-v25` and wallpapers pre-cached.
- README rebuilt with banner, release links, wallpaper gallery, architecture, formulas, validation pair and privacy documentation.

## Validation

- Ten TypeScript regression tests pass and cover structured association, field theft, pairing, negative totals and the reported huge-positive T1 failure.
- Three Android JVM updater-policy tests cover semantic versions, repository URL allowlisting and ABI asset selection.
- Production TypeScript/Vite build passes.
- Android `testDebugUnitTest assembleRelease` passes using JDK 21 and Android SDK 35.
- APK architecture checks confirm one ABI per release build.
- Both APKs verify with signature schemes v1 and v2 and the retained Pump Book update certificate.

```text
b196babf56d576abb32213dd21ed84af05d747c75931c4ea7b44cceec55c0703  Pump-Book-4.2.1-arm64.apk
339fad97740eaf3143040caffdc2a4f4d8ca17d50c534bb1b2292b801ca3968e  Pump-Book-4.2.1-armv7.apk
```

## One-time test-build signing transition

The ephemeral debug key used for the published 4.1.3 test APK was deleted during the requested workspace cleanup and cannot be reconstructed from an APK. Android will therefore reject an in-place update. Before uninstalling 4.1.3, create a `.pumpbook` backup; then install 4.2.1 and restore it. Version 4.2.1 and future updater-compatible releases use the new retained long-lived certificate documented in `docs/ANDROID_SIGNING.md`.
