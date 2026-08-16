# Pump Book 3.0.0 — Full Mobile QA & Repair Report

**Audit date:** 15 August 2026
**Scope:** responsive layout, clipping, scanner modal, OCR correctness, touch targets, PWA caching, payment artwork, build health
**Result:** critical clipping and T1 OCR issues found during browser testing were repaired before this report.

---

## 1. Test environment

The app was run locally with the production React/TypeScript code and tested in a real headless Chromium browser at these viewport sizes:

| Device class | Viewport | Horizontal page overflow after fix |
|---|---:|---:|
| Very small Android | 320 × 568 | None |
| Small Android | 360 × 640 | None |
| Typical Android | 393 × 852 | None |
| Large Android | 412 × 915 | None |
| Tablet portrait | 768 × 1024 | None |
| Desktop | 1440 × 900 | None |

The scanner was also tested at **320 × 568** and **393 × 852** with the supplied IndianOil slip image.

---

## 2. Critical problems found and repaired

### P0 — Cards were wider than small phone screens

**Observed:** At 320–412px widths, the main grid calculated an intrinsic width close to 500px. Cards, scanner controls, totalizer fields and bottom actions extended beyond the right edge. Since the document hid horizontal overflow, content looked cut rather than scrollable.

**Root cause:** Nested CSS Grid/Flex children retained their min-content width. `main`, `.card`, scanner actions, payment cards and calculation blocks did not consistently use `min-width: 0`.

**Repair:**
- Added explicit `min-width: 0` and `max-width: 100%` containment throughout the grid/flex hierarchy.
- Forced cards and responsive grids to use the available device width.
- Added a two-column scanner action layout with a shrinkable main button.
- Kept the calculation table inside its own horizontal scroll container instead of expanding the page.

**Verification:** Document `scrollWidth` now equals viewport width at 320, 360, 393, 412, 768 and 1440px.

### P0 — Scanner opened below the screen and was clipped

**Observed:** On mobile, the scanner dialog could be positioned hundreds of pixels below the viewport and clipped inside the Totalizer card. In automated testing its top was at page Y=857 instead of viewport Y=0.

**Root cause:** The scanner is rendered inside a card. The card’s `backdrop-filter` created a containing block for `position: fixed`, while mobile `overflow: hidden` clipped the dialog.

**Repair:**
- Removed card backdrop filtering and clipping behavior.
- Anchored scanner backdrop to the real viewport with `100vw × 100dvh` and a high app-level z-index.
- On mobile, scanner modal now uses exact viewport bounds: top 0, left 0, width 100vw, height 100dvh.
- Added body scroll lock while scanner is open.
- Kept scanner header and confirmation footer sticky and inside safe areas.

**Verification at 320 × 568:** scanner bounds are exactly `0,0 → 320,568`; footer remains visible at the bottom.

### P0 — T1 could be wrong or empty

**Observed:** The fast OCR pass read the nearby monthly-volume line as `17058.363`, while T1 should be `730606.996`. Earlier versions also left T1 blank.

**Root causes:**
1. Fast fixed-line OCR could overlap an adjacent thermal-print line.
2. OCR normalization removed all whitespace, including line breaks. Separate numbers could join and form a false decimal.
3. T1 high-contrast crop was temporarily too broad.

**Repair:**
- T1 is now always verified by a dedicated high-contrast crop, even when the fast pass returns a value.
- Restored the precisely calibrated T1 crop bounds.
- Enlarges the crop 2× and applies a thermal-print threshold.
- Preserves line breaks during number parsing so separate OCR lines cannot merge.
- Uses the verified T1 result to override the untrusted fast result.

**Verified sample output:**

| Nozzle | OCR result |
|---|---:|
| T1 | **730606.996** |
| T2 | **1842170.070** |
| T3 | **133656.511** |
| T4 | **4144534.178** |

### P1 — Touch targets were too short

**Observed:** Several fields were approximately 39px tall, below the preferred 44px mobile touch size.

**Repair:** Inputs, payment controls, mode controls and major action buttons now use at least 44px height.

### P1 — Scanner background could move

**Observed:** The page behind the modal could remain scrollable, making the dialog feel detached.

**Repair:** Body scrolling is locked for the scanner lifetime and restored when the scanner closes.

---

## 3. Current responsive behavior

### 320–370px phones
- One-column totalizers, settings and summaries.
- One-column payment cards at the narrowest breakpoint.
- Scanner button shrinks without pushing Upload off-screen.
- Header metadata is reduced; nonessential trust chip is hidden at 370px and below.
- Calculation table scrolls internally.
- Bottom actions use full available width.

### 393–600px phones
- Two-column payment grid where space allows.
- Scanner uses the complete dynamic viewport height.
- Preview scales to approximately 30dvh while results remain scrollable.
- Inputs stay at 16px to prevent iOS focus zoom.

### Tablet and desktop
- Totalizers and payment cards expand into multi-column layouts.
- Content is capped at 1160px to prevent overly long line widths.
- Larger hero, section spacing and summary hierarchy are preserved.

---

## 4. Scanner architecture status

Pump Vision currently uses:

1. Four fast targeted OCR line passes.
2. Always-on T1 high-contrast verification.
3. Multiple thermal thresholds when required.
4. Full-document OCR fallback for missing values.
5. Fuzzy `Nozzle` and `CumVolume` parsing.
6. 0°, −3° and +3° rotation retries.
7. Automatic orientation handling.
8. Editable confirmation before values are applied.

### Scanner limitations that remain

- Strong perspective distortion is not the same as simple rotation; extreme trapezoid-shaped receipts may still need manual correction.
- A slip cut above/below a CumVolume line cannot be reconstructed reliably.
- The first scan may be slower because the English OCR model must be downloaded and cached.
- Thermal blur, glare or folded paper can reduce confidence.
- OCR should never bypass the confirmation screen for financial records.

---

## 5. Payment artwork status

Dedicated local SVG assets exist for:

- Paytm
- PhonePe
- Cash
- Bank
- F-Card
- Udhari
- Kharche
- Other adjustment

All assets are bundled locally, work offline and scale without blur. Payment cards automatically change between four, two and one column based on available width.

---

## 6. Mobile zoom decision

The app currently locks pinch/double-tap zoom through viewport settings and pan-only touch behavior, as requested. Inputs use at least 16px on mobile to avoid automatic browser focus zoom.

**Trade-off:** Zoom lock provides a more native-app-like shell but reduces accessibility for users who rely on browser magnification. A future settings toggle could offer “App mode” and “Accessible zoom mode.”

---

## 7. Premium camera and one-page printing update

### In-app camera
- Smart Scan now opens Pump Book’s own `getUserMedia` camera instead of immediately handing control to the phone’s basic file camera.
- Includes a live document guide, animated scan laser, HD capture, camera flip and hardware torch control when the browser/device exposes it.
- Camera remains exactly within `100vw × 100dvh`; automated fake-camera testing passed at 393 × 852.
- Gallery Upload remains available when permission is denied or a device lacks the camera API.
- The captured frame is converted to a high-quality JPEG and sent directly into the existing OCR verification pipeline.

### One-page print sheet
- Normal app cards are hidden during printing.
- A dedicated Excel-style report is generated in A4 landscape format.
- Contains header metadata, four totalizers, fuel summary, eight payment modes, final reconciliation, status and three signature lines.
- Automated Chromium PDF testing produced exactly **one page**.

## 8. Offline history, Excel and hybrid backup (3.1)
- Daily Data Center can save/replace a closing by date and mode.
- Saved days can be filtered by date, reopened into the calculator or deleted.
- Generates a real OOXML `.xlsx` workbook locally with Daily Closing and Payments sheets; no vulnerable spreadsheet dependency is used.
- Current report can be sent through Web Share/WhatsApp-compatible share targets, with clipboard fallback.
- Hybrid storage remains offline-first and adds password-protected AES-GCM backup/restore files.
- Backup contains the current draft and full saved history; wrong password fails without overwriting local data.

## 9. Build and PWA health

- React + TypeScript build: **Pass**
- Vite production build: **Pass**
- JavaScript bundle: approximately **238 kB / 76 kB gzip**
- CSS bundle: approximately **29 kB / 7.3 kB gzip**
- Payment artwork: local SVG
- PWA cache version: `pump-book-v11`
- App version: `3.1.0`

---

## 10. Remaining product risks

### High priority
1. Add automated visual regression tests for every release.
2. Add a real perspective-crop interface with draggable receipt corners.
3. Keep separate morning and evening scan evidence instead of only field values.
4. Add duplicate/invalid-reading detection against previous totals.

### Medium priority
1. Break the long 320px page into collapsible completed steps.
2. Add sticky “Next step” navigation.
3. Add data history, backup and restore.
4. Add PDF/WhatsApp report sharing.
5. Add offline OCR-model prefetch after installation.

### Low priority
1. Optional light/dark themes.
2. User-selectable compact/comfortable density.
3. Haptic feedback where browser support exists.
4. Accessibility zoom toggle.

---

## 11. Release recommendation

Version 2.2.1 is safe to deploy as a **repair release** for the reported clipping and scanner positioning problems. The supplied receipt now returns all four expected CumVolume values in browser testing. Before depending on it operationally, test at least five real morning/evening slip pairs from different lighting conditions and confirm every value manually.
