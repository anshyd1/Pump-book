# Pump Book 4.1.0 — Native URI/ML Kit implementation report

Date: 17 August 2026  
Base repository: `https://github.com/anshyd1/Pump-book`  
Base handoff commit: `47fc741`  
Working branch: `agent/native-uri-mlkit-4.1`

## Scope discipline

This is a targeted scanner change, not a UI redesign or blind rewrite. The existing React/PWA, calculations, reports, storage, Tesseract fallback and confirmation UI remain in place.

## Implemented

### 1. Base64 removed from the native OCR path

The old canvas → JPEG data URL → Base64 Capacitor call was removed from `src/nativeOcr.ts` and `MlKitOcrPlugin.java`.

The Android primary flow is now:

1. Open native ML Kit Document Scanner.
2. Let Google Play services detect/correct the receipt perspective.
3. Copy its corrected JPEG into the app cache.
4. Return only a short `content://` temporary-file URI through Capacitor.
5. Pass that URI to native ML Kit Text Recognition.
6. Return text geometry/results—not image bytes—to JavaScript.

The cache removes scans older than 24 hours during the next scan. Gallery upload and the browser camera continue to use the existing PWA/Tesseract fallback.

### 2. Native ML Kit Document Scanner

Added:

- `DocumentScannerActivity.java`
- `com.google.android.gms:play-services-mlkit-document-scanner:16.0.0`
- one-page JPEG output
- gallery import
- full scanner mode for corner detection, crop, filters and perspective correction

The first use may wait for Google Play services to obtain scanner resources. This must be tested on the user's phone.

### 3. Structured ML Kit parsing

Native OCR now returns:

- text blocks;
- text lines;
- bounding boxes;
- block/line indexes;
- image dimensions;
- stage timings.

`src/structuredOcr.ts` creates vertical Nozzle 1–4 sections from the detected headings, locates `CumVolume` and `ShDayVol` labels, and scores nearby numeric lines using Y distance, block membership, horizontal overlap and bounding boxes. The older full-text regex parser is retained only as a conservative gap-filler.

### 4. Diagnostics and timing

Logcat tag: `PumpBookScan`

Logged native stages:

- `document_scanner_launch`
- `document_scanner_ready`
- `document_cache_copy`
- `input_image`
- `mlkit_complete`
- scanner/OCR errors

The result UI shows native processing and OCR milliseconds. `Diagnostics ZIP` exports:

- `diagnostics.json`
- anonymized OCR text
- perspective-corrected scan image when readable by the WebView

The in-app timer begins after the user confirms the corrected page, avoiding camera-framing/user-decision time. The physical acceptance test should additionally time shutter-to-result with a stopwatch.

### 5. Fixture arithmetic tests

Automated tests model the documented field defects:

- morning T2 missing;
- evening T4 missing;
- evening `ShDayVol` values recover both.

The tests verify all eight documented values:

| Nozzle | Morning | Evening |
|---|---:|---:|
| T1 | 499243.148 | 499590.788 |
| T2 | 501071.921 | 502042.401 |
| T3 | 110538.129 | 110544.109 |
| T4 | 478449.884 | 478519.314 |

Important limitation: the actual files `IMG20260816190448.jpg` and `IMG20260816190937.jpg` were not attached and are not in the public repository. Therefore this verifies structured association/pair reconciliation against the documented expected data, not OCR pixels from those two photos. Upload both photos for a real image-fixture run.

### 6. PWA retained

- `SmartCamera.tsx` remains.
- Gallery upload remains.
- Tesseract multi-pass fallback remains.
- Existing verification and manual-edit screen remains.
- PWA cache moved to `pump-book-v20`.

## Build verification

Passed:

```text
npm test
  2/2 tests passed
npm run build
  TypeScript + Vite production build passed
./gradlew testDebugUnitTest assembleDebug --no-daemon --max-workers=1
  BUILD SUCCESSFUL
```

Android build toolchain used:

- JDK 21
- Android SDK Platform 35
- Android Build Tools 34/35
- Gradle 8.11.1
- AGP 8.7.2

No Android device is connected to this Arena sandbox (`adb devices` is empty), so physical behavior is not claimed as verified.

## Required physical-phone acceptance test

1. Install the supplied debug APK:

   ```bash
   adb install -r Pump-Book-4.1.0-MLKit-URI-debug.apk
   ```

2. Capture logs:

   ```bash
   adb logcat -c
   adb logcat -v time PumpBookScan:I chromium:I '*:S' > pump-book-phone.log
   ```

3. Open **Smart Scan**. On Android it should open the Google document-scanner UI.
4. Scan the morning receipt and confirm slot/readings.
5. Scan the evening receipt and confirm slot/readings.
6. Confirm all eight values in the table above.
7. Check the displayed native processing time; target `< 2000 ms` after corrected-page confirmation.
8. Repeat 10 scans and confirm no WebView freeze or increasing memory instability.
9. Tap **Diagnostics ZIP** after a scan and retain it with `pump-book-phone.log` for any failure.
10. Confirm gallery/PWA fallback still scans when native scanner is unavailable.

## Known physical-test risks

- ML Kit Document Scanner depends on a compatible/up-to-date Google Play services installation.
- First scanner launch can be slower while scanner resources are obtained.
- `content://` preview/export behavior still needs confirmation on the exact phone/WebView.
- Debug APK is not a production release-signed APK/AAB.

## Security reminder

A GitHub PAT was previously pasted in chat. Revoke that token and create a fresh least-privilege token if repository write access is needed. The old token was not used or copied into this source.
