# Android signing and in-app updates

Android accepts an APK as an update only when its package name and signing certificate match the installed app.

## Pump Book 4.2.1+ update certificate

```text
Package: in.pumpbook.app
SHA-256 certificate:
E5:1F:10:78:67:36:12:DD:4F:6E:1C:84:D7:DB:01:95:A5:02:5B:15:29:DF:01:C4:5B:43:BA:02:0A:FB:F1:6D
Validity: 2026-08-17 through 2054-01-02
```

The private keystore and password are intentionally **not committed**. On the controlled build workspace they are stored with owner-only permissions under `~/.android/`. `android/app/build.gradle` uses that signing configuration when it is present; otherwise local development falls back to the normal Android debug behavior.

Before publishing any 4.2.2+ APK:

1. Build with the secured Pump Book keystore.
2. Run `apksigner verify --verbose --print-certs`.
3. Confirm the certificate SHA-256 matches the fingerprint above.
4. Confirm the version code increased.
5. Upload both ABI APKs and `SHA256SUMS.txt` to one GitHub release.

Do not commit, print, paste into chat or package the private keystore/password. If this key is lost, Android cannot install future APKs over 4.2.1; users would need another uninstall/reinstall migration.
