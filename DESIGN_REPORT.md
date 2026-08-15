# Pump Book 2.0 — Product, Brand & Scanner Report

## Product direction
Pump Book is now positioned as a focused petrol-pump daily-closing product rather than a generic calculator. The product promise is: **“Scan readings. Match every rupee.”**

## Brand system
- **Mascot:** Pumpu — an animated fuel-drop and receipt character.
- **Primary:** Deep pump navy `#062D3A` for trust and operational clarity.
- **Action:** Fuel teal `#0B9078` and mint `#32D1AA` for scanning and success.
- **Accent:** Fuel amber `#FFB633` for the Book wordmark and attention.
- **Status:** Green for matched accounts; red only for faults and invalid readings.
- New 192px and 512px PWA icons use the Pumpu identity.

## Information architecture
1. **Scan** — morning and evening totalizers.
2. **Set** — testing quantity, fuel rate and adjustments.
3. **Review** — fuel quantity and amount calculation.
4. **Match** — digital payments, credit, expenses and cash.

A compact journey bar makes this sequence visible from the top of the app.

## UI upgrade
- Branded hero with mascot, product promise and privacy/offline/OCR trust chips.
- Premium layered cards, consistent 24px radius and responsive spacing system.
- Clear section icons and subtitles.
- Nozzle cards now have stronger hierarchy, fuel badges and highlighted differences.
- Live summary, reconciliation states, controls, footer and print styles refreshed.
- Mobile layouts optimized down to 320px; motion respects `prefers-reduced-motion`.

## Pump Vision OCR 2.0
The scanner now uses a multi-pass strategy:

1. **Fast line pass** for a normally framed IndianOil 4-nozzle slip.
2. **High-contrast thermal pass** for faint T1 printing using 2× enlargement and multiple thresholds.
3. **Document intelligence pass** when readings are missing:
   - grayscale + contrast enhancement;
   - full-document OCR instead of fixed coordinates;
   - fuzzy `Nozzle` and `CumVolume` parsing;
   - automatic orientation check;
   - retries at 0°, −3° and +3° for crooked photos;
   - label-order fallback for zoomed/cropped images.
4. User verification remains mandatory before auto-fill.

The scanner interface includes animated framing corners, laser sweep, Pumpu scan animation, progress stages, confidence display and manual corrections.

## Adaptive layout & payment identity (2.1)
- Spacing, type and card sizes now use fluid `clamp()` values instead of one fixed phone size.
- Safe-area insets and `dvh` prevent scanner controls from being cut off on notched or short devices.
- Payment inputs are distinct branded tiles: Paytm wordmark, PhonePe badge, Cash, Bank, F-Card, Udhari, Kharche and Other icons.
- Payment grid automatically changes from four columns to two or one based on available width.

## Mobile interaction & payment artwork (2.2)
- Pinch/double-tap viewport zoom is locked for an app-like mobile shell.
- Inputs use a minimum 16px mobile font to prevent automatic focus zoom on iOS.
- Eight dedicated local SVG payment illustrations replace generic line symbols.
- All artwork ships inside the PWA and works without an image CDN.

## Engineering and release
- React + TypeScript build passes.
- OCR remains on-device with Tesseract.js.
- PWA cache bumped to `pump-book-v6`.
- Product version: `2.0.0`.
- New assets remain local; no external font or image dependency.
