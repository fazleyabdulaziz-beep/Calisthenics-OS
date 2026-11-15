# Calisthenics OS — PWA setup

## Deployment

Deploy the project to GitHub Pages over HTTPS. Keep these files at the project root:

- `manifest.webmanifest`
- `service-worker.js`
- `index.html`
- `assets/icon-180.png`
- `assets/icon-192.png`
- `assets/icon-512.png`

The manifest uses relative paths so it works under a GitHub Pages project URL such as `/Calisthenics-OS/`.

## Install on iPhone / iPad

1. Open the GitHub Pages site in Safari.
2. Tap Share.
3. Choose **Add to Home Screen**.
4. Tap **Add**.

iOS does not support the Chromium `beforeinstallprompt` install dialog. The in-app Install app button displays these instructions instead.

## Install on Android / desktop

Use the in-app **Install app** button when the browser exposes the PWA install prompt. Otherwise use the browser menu and choose **Install app** or **Add to Home Screen**.

## Service worker

The service worker caches the app shell and uses network-first requests for same-origin assets, with cached fallback when offline. API requests to the Cloudflare Worker are cross-origin and are not intercepted.

## Everyday routine note

The frontend now allows choosing **Everyday** and will display an Everyday routine on the dashboard when no weekday routine is returned. To make the dashboard's completed-exercise progress count correctly for Everyday routines, update the Apps Script `dashboardData_()` logic to select an Everyday routine as a fallback before calculating `completedExercises`.
