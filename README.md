# Pump Book

Professional React + TypeScript progressive web app for one-day fuel totalizer and payment reconciliation (petrol pump daily closing / हिसाब).

Live: https://anshyd1.github.io/Pump-book/

## Pump Book 2.0

A complete visual and scanning upgrade with the new **Pumpu** mascot, petrol-pump brand system, animated Pump Vision scanner, responsive workflow navigation and refreshed PWA icons.

## Features

- **Premium in-app Pump Vision camera** — live camera preview, receipt framing guide, animated laser, HD capture, torch control, camera flip and Gallery fallback
- **One-page Excel-style print report** — dedicated A4 landscape sheet with totalizers, fuel sale, payment breakup, reconciliation and signatures
- **Daily Data Center** — saved closing history, date filter, restore/open/delete, WhatsApp/Web Share and real multi-sheet `.xlsx` export
- **Hybrid backup** — offline-first local history plus password-protected AES-GCM `.pumpbook` backup/restore
- **Pump Vision OCR** — fast fixed-layout pass + high-contrast thermal-print recovery + layout-independent document OCR
- Smart fallback handles zoomed, lightly rotated (±3°), faint and imperfectly framed slips; `rotateAuto` also checks orientation
- Animated scanner frame, laser sweep, progress stages, confidence score and editable verification
- Pumpu mascot, branded app header, new green/amber fuel theme and four-step daily closing journey
- Fluid device spacing with `clamp()`, safe-area support and adaptive scanner height for small/large phones
- Branded payment tiles with dedicated local SVG artwork: Paytm, PhonePe, Cash, Bank, F-Card, Udhari, Kharche and Other
- Mobile zoom locked through viewport rules, pan-only touch behavior and 16px focus-safe inputs
- Mode 1: HSD / HSD / HSD / HSD · Mode 2: MS / HSD / MS / HSD
- Evening minus Morning live totalizer differences
- Testing deductions and editable HSD/MS rates
- Extra plus/minus adjustment
- **Full step-by-step calculation view** (हर line का हिसाब) + per-nozzle detail
- Udhari, Paytm, F-Card, PhonePe, bank, expenses and cash reconciliation
- Balance/Fault with Match/Check result
- **Fast 2-slip OCR scanner** — सुबह/शाम चुनकर IndianOil slip camera या gallery से scan करें; केवल चार `CumVolume` lines पढ़कर T1–T4 में भरता है (4 + 4 = 8 readings, manual confirmation सहित)
- Totalizer cards के नीचे अलग-अलग camera/photo controls नहीं—एक central scanner और gallery upload
- **Empty inputs** — no prefilled zeros to delete
- **Auto-save** draft to device (har change save hota hai)
- **Print report** button for showing the day summary
- **Install button** + offline-capable PWA (Add to Home Screen)

## Development

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

GitHub Actions automatically builds and deploys `dist` to GitHub Pages after every push to `main`.
