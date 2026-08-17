# Pump Book 4.1.3 — T4 false-field rejection

Field screenshot reproduced a dangerous association: T4 Evening was filled with `388028.470`, which is the printed `ShMTHSale`, not `CumVolume`. This produced a negative difference against Morning `478449.884`.

Corrections:

- CumVolume/ShDayVol geometry accepts values only on the label row or below it; monthly fields above a missing CumVolume are never candidates.
- Scanner blocks Auto Fill if Closing is lower than an existing Opening.
- Pairing layer repeats the same monotonic guard so invalid OCR cannot be stored if UI validation is bypassed.
- If T4 CumVolume is unreadable but T4 ShDayVol is valid, Evening is safely derived from existing Morning + ShDayVol.
- Added exact regression cases for the observed `ShMTHSale 388028.470` confusion and negative T4 closing.

Verification:

```text
npm test: 6/6 passed
npm run build: passed
Android testDebugUnitTest assembleDebug: BUILD SUCCESSFUL
```

The production source contains no hard-coded field fixture readings.
