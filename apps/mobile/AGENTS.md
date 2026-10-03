# apps/mobile — Capacitor shell (iOS, Android)

The same web app as a native app. The WebView loads the running `apps/web` from `CAP_SERVER_URL`
(no static export: the web app has route handlers). Native code is only the shell; features go in
the web app, with native APIs behind `apps/web/src/lib/native/` (Capacitor in the app, browser API
otherwise). Plugins must be dependencies of **both** `apps/mobile` (so `cap sync` links them
natively) and `apps/web` (so the web code can import them).

## Commands (from the repo root)

```bash
npm run mobile:ios                          # sync + build + run in the iOS Simulator (pick a target)
npm run ios -w apps/mobile -- --target <simulator-udid>   # non-interactive (xcrun simctl list devices)
npm run ios:open -w apps/mobile             # sync + open in Xcode
npm run mobile:android                      # sync + ./gradlew assembleDebug → android/app/build/outputs/apk/debug/
npm run assets -w apps/mobile               # re-render icons and splash from the LogoMark (needs rsvg-convert)
```

- `CAP_SERVER_URL`: shell env > `apps/mobile/.env` > `.env.example` (`http://localhost:3000`, the
  Simulator default). Phone on Wi-Fi: `http://<mac-lan-ip>:3000` (web app started with `npm run dev -w apps/web -- -H 0.0.0.0`). Android emulator: `http://10.0.2.2:3000`.
  Production: the Vercel URL. Baked in at `cap sync` — rerun the script after changing it.
- Cleartext HTTP is meant for local dev only: iOS ATS `NSAllowsLocalNetworking` (local names and IP
  addresses), Android `server.cleartext` only for localhost/private IPs. Production uses HTTPS.
- Android needs `JAVA_HOME` (JDK 21 — newer JDKs break Gradle) and `ANDROID_HOME` (Android SDK) in
  the environment, or `sdk.dir` in the gitignored `android/local.properties`.
- `www/error.html` is the bundled "Brak połączenia" page, shown when the server can't be reached.
- `/dev/native` in the web app shows the platform and asks for the position on load — handy to
  check the native bridge in the Simulator without tapping.
- Native projects (`ios/`, `android/`) are committed and owned by us (Info.plist, manifest, icons);
  `cap sync` output (`public/`, `capacitor.config.json`) is gitignored. Not part of lint/CI.
