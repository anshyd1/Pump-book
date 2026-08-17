# Pump Book 4.0 — Android ML Kit Edition

## Why Android
A static browser PWA cannot access a universally available native OCR engine. Tesseract.js is free and offline but needs several seconds on mobile and struggles with occluded thermal digits. Google ML Kit Text Recognition runs on-device, is offered at no cost, works offline and supports real-time mobile use cases.

Official references:
- https://android-developers.googleblog.com/2020/06/mlkit-on-device-machine-learning-solutions.html
- https://developers.google.com/ml-kit/vision/text-recognition/v2/android

## Architecture
- Existing React/Vite Pump Book UI remains shared with the PWA.
- Capacitor 7 Android shell (`in.pumpbook.app`).
- Custom native Capacitor plugin `MlKitOcrPlugin`.
- Bundled Latin text model: `com.google.mlkit:text-recognition:16.0.1`.
- JavaScript auto-detects Android native mode and sends the normalized receipt to ML Kit.
- If native ML Kit is unavailable or returns fewer than three totalizers, Tesseract fallback still runs.
- Morning/evening paired-slip ShDayVol reconciliation remains enabled.

## Expected behavior
1. Capture or upload a receipt.
2. Browser-side paper crop normalizes EXIF orientation and removes most background.
3. Android ML Kit reads the receipt locally.
4. Structured parser extracts CumVolume and ShDayVol.
5. Three or four direct readings return immediately; paired-slip logic derives an occluded counterpart where mathematically verifiable.
6. No API key, cloud request, per-scan billing or usage quota.

## APK build
GitHub Actions workflow: `.github/workflows/android-apk.yml`

On every relevant push it:
- installs Node dependencies;
- builds the Vite app;
- syncs Capacitor Android assets;
- installs Java 21 and Android SDK;
- builds `app-debug.apk`;
- uploads artifact `pump-book-android-apk` for 30 days.

Download from GitHub → Actions → Build Pump Book Android APK → latest successful run → Artifacts.

## Security and privacy
- Receipt image remains on the Android device for ML Kit recognition.
- No OCR API key is embedded.
- No per-scan server upload is required.
- Existing encrypted Pump Book backup remains separate and user-controlled.

## Compatibility
- Android API 21+ through ML Kit/Capacitor project settings.
- Google Play Services recommended.
- PWA remains available for browsers and uses Tesseract fallback.
