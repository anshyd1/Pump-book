# Pump Book

Professional React + TypeScript progressive web app for one-day fuel totalizer and payment reconciliation (petrol pump daily closing / हिसाब).

Live: https://anshyd1.github.io/Pump-book/

## Features

- Mode 1: HSD / HSD / HSD / HSD · Mode 2: MS / HSD / MS / HSD
- Evening minus Morning live totalizer differences
- Testing deductions and editable HSD/MS rates
- Extra plus/minus adjustment
- **Full step-by-step calculation view** (हर line का हिसाब) + per-nozzle detail
- Udhari, Paytm, F-Card, PhonePe, bank, expenses and cash reconciliation
- Balance/Fault with Match/Check result
- **2-slip OCR scanner** — सुबह और शाम की IndianOil slips camera/gallery से scan करें; printed time से Morning/Opening या Evening/Closing auto-detect करके Nozzle 1–4 के `CumVolume` भरें (4 + 4 = 8 readings, manual confirmation सहित)
- **Camera & gallery** — 📷 se har totalizer (T1-T4) ki reading photo lo, thumbnail tap karke bada dekho, save/share karo
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
