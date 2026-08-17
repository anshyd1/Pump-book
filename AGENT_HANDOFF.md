# Pump Book — Agent Handoff

> Read this file before changing the app. Do not redesign or rewrite blindly.

## Product

Pump Book is an offline-first React + TypeScript PWA and Capacitor Android app for petrol-pump daily closing. It scans IndianOil-style shift totalizer receipts, pairs explicit Morning/Opening and Evening/Closing readings, calculates HSD/MS fuel sale, reconciles payments, saves local history and exports reports.

Current source version: **4.2.1** (`versionCode 421`).

## Non-negotiable architecture

1. Android primary OCR is bundled Google ML Kit Text Recognition.
2. Native scan images stay in app cache. A temporary `content://` URI crosses the Capacitor bridge; image bytes/Base64 do not.
3. Native OCR returns structured blocks, lines and bounding boxes.
4. Google ML Kit Document Scanner provides perspective correction.
5. PWA/Tesseract remains the fallback; do not remove it.
6. Morning/Evening assignment is explicit. Never infer from the current clock or filename.
7. One scan must never silently fill both columns.
8. Production code must never hard-code fixture readings or pump-specific totalizer magnitudes.
9. `CumVolume` must not be confused with `ShMTHSale`, `ShMTHVol` or `CumSale`.
10. `Closing >= Opening` is mandatory.
11. When printed `ShDayVol` exists, `Closing - Opening` must match it within tolerance.
12. If DayVol is unavailable, an extreme cross-nozzle outlier safety hold catches magnitude-independent impossible positive differences.
13. Incomplete/invalid readings must show a safety hold, not a final amount.
14. Preserve the capture-to-result target of under two seconds on the Android native path.
15. The updater may download only HTTPS APK assets under `anshyd1/Pump-book/releases/download/` and must use Android’s user-confirmed package installer—never root or silent install.
16. Future APK updates require the same signing certificate. Do not rotate or delete the 4.2.1+ signing key without planning a migration.

## 4.2 UI structure

- Home dashboard
- Daily Closing workflow
- Separate History/Data Center
- Settings
- Mobile bottom navigation and hamburger drawer
- System/Light/Dark/AMOLED themes
- Four bundled AI-designed wallpapers plus Clean Ledger
- Reduce Motion and Compact layout options
- Fuel-drop + ledger + gauge identity, short liquid intro and “by Ansh” signature

## Persistence

- Draft: `pump-book-draft-v4`
- History: `pump-book-history-v1`
- Preferences: `pump-book-preferences-v1`
- Older `v2`/`v3` drafts are sanitized and migrated at read time.
- Evening ShDayVol evidence is persisted per mode in `scanEvidence`.
- Backup payload remains version 1 for backward compatibility; `sanitize()` supplies missing fields.

## OCR validation pair

Files:

- `tests/fixtures/new-large-record-morning.jpg`
- `tests/fixtures/new-large-record-evening.jpg`
- `tests/fixtures/expected-readings.json`

Expected differences:

- T1 `412.750`
- T2 `1188.625`
- T3 `236.480`
- T4 `895.360`

Mode 2 at HSD ₹95.50, MS ₹102.01 and Testing 0 must produce **₹2,65,248.52**.

The fixtures are documentation/test inputs only. Production modules must not import the JSON or images.

## Commands

```bash
npm ci
npm test
npm run build
npm run android:sync
cd android
./gradlew testDebugUnitTest assembleDebug
```

Capacitor Android 7 currently requires **JDK 21**. Android compile/target SDK is 35.

## Current regression suite

Ten TypeScript tests cover:

- four-nozzle ML Kit line-box association
- OCR spacing and `Nozzle Nol`
- missing CumVolume not stealing ShMTHSale
- one-slip pairing safety
- negative Closing rejection
- documented Morning/Evening reconciliation
- the reported huge-positive T1 failure
- cross-nozzle outlier safety
- exact generated pair ShDayVol verification
- text fallback stopping before ShMTHVol/CumSale

## Release build facts

Local 4.2.1 APKs are ABI-specific:

- ARM64: `Pump-Book-4.2.1-arm64.apk`
- ARMv7: `Pump-Book-4.2.1-armv7.apk`

The old 4.1.3 debug signing key was ephemeral and was deleted during an explicit workspace cleanup. It cannot be reconstructed from the published APK. A 4.1.3 → 4.2.1 install requires backup, uninstall, install and restore. Do not hide this from users.

Version 4.2.1 establishes a long-lived update certificate documented in `docs/ANDROID_SIGNING.md`. Its private keystore/password live only in the controlled workspace under owner-only `~/.android/` files and must never be committed or echoed. Every future release must match that documented SHA-256 certificate or the in-app updater cannot perform an Android update.

## Repository and publication

- Repository: `https://github.com/anshyd1/Pump-book`
- PWA: `https://anshyd1.github.io/Pump-book/`
- Last published pre-4.2 commit: `f5f210db09d4f07b96534522ea75321c42e4dd9b`
- Last published release before 4.2: `v4.1.3`

Never commit or echo a GitHub personal access token, signing private key or credential helper.
