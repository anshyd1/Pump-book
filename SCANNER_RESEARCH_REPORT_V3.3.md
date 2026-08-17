# Pump Vision 3.3 — OCR & Low-Camera Research Report

## Executive conclusion

The scanner has two separate problems: **image acquisition** and **text recognition**. A Paytm-like experience does not come from animation or Tesseract settings alone. Production document scanners first obtain a high-resolution still, detect the four paper corners, apply a perspective transform, enhance the paper locally, and only then run OCR.

Pump Book is a static browser PWA. Tesseract.js provides browser OCR, but its own package scope states that it wraps the Tesseract engine and does not modify the underlying recognition model. Web camera capabilities also vary by browser and hardware. Therefore, completely reliable low-camera recognition requires either a native document/OCR SDK or a server/cloud fallback. The local PWA can still be improved substantially, but it must reject uncertain values rather than invent financial readings.

## Sources reviewed

1. Tesseract.js official repository and package scope: https://github.com/naptha/tesseract.js
2. Tesseract.js worker vs scheduler guidance: https://github.com/naptha/tesseract.js/blob/master/docs/workers_vs_schedulers.md
3. Tesseract.js performance guidance: https://github.com/naptha/tesseract.js/blob/master/docs/performance.md
4. MDN MediaTrackConstraints: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
5. W3C MediaStream Image Capture: https://w3c.github.io/mediacapture-image/
6. OpenCV browser document scanner architecture: https://opencv.org/blog/smart-document-scanning-with-live-ocr-using-opencv-js/
7. Receipt detection and four-point transform example: https://pyimagesearch.com/2021/10/27/automatically-ocring-receipts-and-scans/

## What the research confirms

### 1. Worker setup was part of the delay
Official Tesseract.js guidance recommends creating a worker once and reusing it. Creating/loading/destroying a worker for every recognition wastes setup time. Pump Book now retains one worker for two minutes, covering a typical morning/evening scan sequence.

### 2. Low-quality input cannot be fixed by OCR parameters alone
Tesseract requires readable character pixels. Upscaling helps segmentation but cannot recreate digits erased by blur/JPEG compression. Recommended preprocessing is tight crop, grayscale, local/adaptive thresholding, noise handling, deskew and correct PSM.

### 3. Video screenshots may be lower quality than still capture
The browser video frame can be lower resolution or transformed compared with a still image. The Image Capture API can request a proper photo blob from the camera track where supported. Pump Book now tries `ImageCapture.takePhoto()` first and falls back to the video frame only when unavailable.

### 4. Browser camera controls are capability-dependent
Zoom, torch, focus mode and focus distance must be discovered through `getCapabilities()` and applied only if supported. Android Chromium exposes more controls than iOS Safari; no PWA can force unsupported focus hardware.

### 5. Perspective correction is geometry, not OCR
A rotated rectangle and a trapezoid are different. A true scanner detects the largest four-point receipt contour and performs a homography/warp before OCR. Pump Book’s current lightweight auto-crop is not yet a full four-corner perspective warp.

## Measured test data

Tests were run in Chromium using the supplied IndianOil slip and synthetic degraded versions.

| Input | Image characteristics | Time | Result |
|---|---|---:|---|
| Original | 3072×4096, clear full scene | ~4.6s | T1–T4 correct |
| Repeated original | Warm worker | ~4.2s | T1–T4 correct |
| Low full scene | 720×960, JPEG 42, blur 0.45 | ~6s | T3/T4 recovered; T1/T2 insufficient detail |
| Low guide crop | 650×1566, receipt fills capture | ~6.5s | T2/T3/T4 correct; faint T1 missing |
| Artificial dark low scene | 720×960, brightness 62%, JPEG 38 | ~6s | Insufficient for safe complete autofill |

The data shows that **making the receipt fill the captured guide matters more than simply increasing the output dimensions**. The faint T1 thermal line remains the hardest field.

## Repairs implemented in 3.3

### Camera acquisition
- Device-native environment stream instead of forced landscape/tall resolution.
- Full sensor `contain` preview; no hidden cover crop.
- Minimum supported hardware zoom.
- Continuous focus mode where available.
- Full-resolution `ImageCapture.takePhoto()` when supported.
- Correct mapping from visible guide coordinates to still-photo pixels.
- Video-frame fallback for browsers without ImageCapture.
- Captured guide region with safe padding rather than the entire scene.

### Capture quality gate
Before OCR, the app measures:
- mean brightness;
- approximate edge/sharpness score;
- extreme-white glare ratio.

A low-quality capture shows a specific warning with **Retake** and **Use anyway**. It does not silently waste OCR time on an obviously unreadable frame.

### OCR preprocessing
- Low-resolution images upscale to a bounded 3000px working size.
- Receipt component auto-detection and crop.
- T1 high-contrast verification.
- Local adaptive threshold for missing fields.
- Nozzle-specific magnitude checks to reject truncated numbers.
- Line breaks preserved so separate OCR numbers cannot merge.
- 12-second fallback budget; no uncontrolled retry storm.
- Warm worker reuse.

## Why a reading may still stay blank

Pump Book intentionally leaves a field blank when it cannot verify the complete cumulative number. Examples such as `842170.070`, `.178`, or `30606.996` may be recognizable fragments, but automatically adding assumed leading digits is unsafe for a financial closing app.

## Field photos received on 17 August: root cause and retest

The failing screenshots supplied two new Pump S.No. `21100762` receipts. Their totalizers are around 110k–502k, while the earlier Pump S.No. `21060975` receipt ranged from 133k to 4.1m. An earlier safety rule incorrectly encoded the old machine's magnitude per nozzle and rejected valid readings from the new machine. That rule has been removed.

The new firmware also prints longer nozzle blocks, so CumVolume appears at different vertical positions. Version 3.3.1 now runs a high-resolution, layout-independent receipt pass before coordinate fallbacks.

Actual browser retest:

| Actual field photo | Directly verified by OCR |
|---|---|
| 16/08/2026 19:01:59 | T1 `499590.788`, T2 `502042.401`, T3 `110544.109` |
| 16/08/2026 07:23:47 | T1 `499243.148`, T3 `110538.129`, T4 `478449.884` |
| Earlier Pump 21060975 | all four readings correct |

The pen mark obscures morning T2's last decimal and edge perspective damages evening T4 OCR. Version 3.4 therefore parses each nozzle's printed `ShDayVol` and reconciles the pair mathematically:

- Morning = Evening − ShDayVol
- Evening = Morning + ShDayVol

Pair test in Chromium, scanning the supplied morning then evening photos, produced all eight verified values:

- T1: opening `499243.148`, closing `499590.788`
- T2: opening `501071.921`, closing `502042.401`
- T3: opening `110538.129`, closing `110544.109`
- T4: opening `478449.884`, closing `478519.314`

The app also auto-selected Morning/Evening from the filename timestamp (`190448` and `190937`) when OCR time was unclear.

## Required next architecture for Paytm-level reliability

### Option A — Browser OpenCV (offline, larger app)
- Load OpenCV.js/WASM on scanner demand.
- Canny edge detection.
- Largest four-point contour.
- Four-point perspective warp.
- Adaptive Gaussian threshold and morphology.
- OCR only the normalized receipt.

Trade-off: roughly multi-megabyte WASM, slower first load and significant memory use on low-end phones.

### Option B — Native Android app
- CameraX still capture.
- ML Kit Text Recognition.
- Native focus/exposure/tap-to-focus.
- Better low-end device handling.

Trade-off: separate APK/app project rather than only GitHub Pages.

### Option C — Hybrid cloud fallback
- Fast local OCR first.
- If confidence is below 100%, upload only the cropped receipt to a secure OCR API.
- Return structured T1–T4 readings.

Trade-off: backend, API cost, privacy policy and network requirement.

## Recommendation

For the current static PWA, version 3.3 is the correct safe ceiling for lightweight local OCR: high-resolution still capture, quality gating, crop, upscaling, adaptive thresholding and bounded retries. For genuinely Paytm-level reliability across poor cameras and badly angled receipts, implement **OpenCV perspective correction plus a cloud/native fallback**. A failing real camera capture must be retained as a test fixture; without the exact failed pixels, tuning against only the original clear photo will not solve the field case.
