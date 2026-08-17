# Pump Book 4.1.2 — pairing safety correction

- No field receipt values are hard-coded in production `src/` or Android code. Documented values remain only in automated tests/reports.
- Removed photo-filename time and current-clock fallback for Morning/Evening classification.
- If the printed receipt time is not confidently recognized, the user must explicitly choose Morning or Evening before Auto Fill is enabled.
- One Evening slip no longer fills an empty Morning column by itself, even when `ShDayVol` is present.
- Opposite-column derivation is enabled only after evidence of the other slip/entry exists.
- Morning `ShDayVol = 0.000` is never used to copy an Evening value into Morning.
- Added regression test proving a single Evening scan leaves all Morning fields empty.

Verification:

```text
npm test: 4/4 passed
npm run build: passed
Android testDebugUnitTest assembleDebug: BUILD SUCCESSFUL
```
