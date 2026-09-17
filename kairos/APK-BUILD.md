# Kairos → Android APK

Kairos ships as an **offline-first PWA**: all data lives on the device
(localStorage), there are no network calls, and it installs to the home screen.
There are three ways to get it onto an Android phone.

---

## Option 1 — Install directly as an app (no build needed)

1. Host this app anywhere HTTPS (Vercel, Netlify, your own server — or use the preview URL).
2. Open the URL in **Chrome on Android**.
3. Tap **⋮ → "Add to Home screen"** / **"Install app"**.

Kairos appears as a real app icon, launches fullscreen, and works with zero
internet connection.

---

## Option 2 — PWABuilder (produces a real, signed .apk/.aab)

1. Host the app on an HTTPS URL.
2. Go to **https://www.pwabuilder.com** and paste the URL.
3. Click **Package for Stores → Android**.
4. Download the generated package — it contains a **signed `.apk`** and an
   `.aab` (Play Store format), built via Trusted Web Activity.

No code changes required — the manifest + service worker already in this repo
are everything PWABuilder needs.

---

## Option 3 — Bubblewrap CLI (TWA, scriptable)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-HOSTED-URL/manifest.webmanifest
bubblewrap build
# → app-release-signed.apk in the project folder
```

---

## Option 4 — Capacitor (bundle the code into the APK itself)

Use this if you want the app bundled inside the APK instead of loading a URL:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init Kairos com.kairos.app --web-dir=out
# static-export the app (set `output: "export"` in next.config.ts and remove
# the unused /api routes), then:
npx next build
npx cap add android
npx cap sync
npx cap open android   # build the APK in Android Studio (Build → Build APK)
```

---

## Why there's no APK generated here

Compiling an APK requires the Android SDK + Gradle, which aren't available in
this sandbox. Options 1–3 above take **under five minutes** and produce the
exact same offline app.
