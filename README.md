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
