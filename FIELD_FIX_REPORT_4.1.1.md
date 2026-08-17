# Pump Book 4.1.1 — field failure correction

Date: 17 August 2026

## Failure acknowledged

The 4.1.0 APK was not acceptable on the user's phone: approximately 46 MB and a reported roughly two-minute gallery scan returned only two readings.

## What the supplied photos prove

Locally received only; do not publish these receipt photos to the public repository:

- `IMG20260816190448.jpg` — morning, EXIF orientation 6 / RightTop
- `IMG20260816190937.jpg` — evening, upright

The morning receipt contains physical pen strokes through cumulative values. A conservative OCR must not invent hidden decimal digits. In the morning image, T1 and T4 remain directly readable; T2/T3 may need pair recovery. The evening image clearly supplies T1/T2/T3 and all four `ShDayVol` values; its T4 is close to the perspective/torn edge.

Safe pair reconciliation still produces:

| Nozzle | Morning | Evening | ShDayVol |
|---|---:|---:|---:|
| T1 | 499243.148 | 499590.788 | 347.640 |
| T2 | 501071.921 | 502042.401 | 970.480 |
| T3 | 110538.129 | 110544.109 | 5.980 |
| T4 | 478449.884 | 478519.314 | 69.430 |

The two-minute delay is not acceptable regardless of the damaged print.

## 4.1.1 corrections

1. **Android Upload no longer starts browser/Tesseract OCR.** It now opens Android's native image picker, copies the selected image to app cache, and sends only the temporary `content://` URI to bundled ML Kit.
2. **Smart Scan still uses ML Kit Document Scanner** for perspective correction.
3. **Bundled ML Kit stays available offline/immediately.** No first-OCR model download is required.
4. **46 MB universal APK removed.** Gradle now builds per-ABI APKs so the same native ML Kit library is not packaged four times:
   - arm64-v8a: approximately 17 MB
   - armeabi-v7a: approximately 13 MB
5. Structured parser now handles `Nozzle Nol`, OCR spaces around decimals, and rejects distant monthly/sale numbers instead of forcing a field match.
6. Partial-result UI explicitly instructs the user to confirm the first slip and scan the other slip for safe `ShDayVol` recovery.
7. Version raised to 4.1.1 / versionCode 411.

## Verification completed in Arena

- TypeScript/Vite production build: passed
- Parser/pair tests: 3/3 passed
- Android Java compile and unit tests: passed
- ABI APK build: passed
- APK signature verification: required before delivery

## Physical test still required

Arena has no connected Android phone. On the user's phone:

1. Install the arm64 APK (the Realme Narzo 20A is expected to use arm64; use the armv7 APK only if Android reports an ABI/install incompatibility).
2. Use **Upload** for the supplied morning photo, confirm slot Morning and save any direct values.
3. Use **Upload** for the evening photo, confirm slot Evening.
4. Verify all eight values above.
5. Record the displayed native processing milliseconds and export Diagnostics ZIP if any value remains blank/wrong.
6. Run 10 repeated scans and inspect `adb logcat -v time PumpBookScan:I '*:S'`.

No claim of sub-two-second physical performance is made until that test is returned from the exact phone.
