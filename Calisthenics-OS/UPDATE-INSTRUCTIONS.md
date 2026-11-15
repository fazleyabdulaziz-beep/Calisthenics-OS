# Calisthenics OS — Daily Auto Completion + Button Loading Update

## Included
- `js/app.js`: per-exercise daily progress display, repeated set numbering, and async button loading states.
- `css/style.css`: spinner and progress-bar styles.
- `apps-script/Api.gs`: backend progress calculation; weekday routine takes priority, with `Everyday` as fallback.

## Apply the update
1. Replace the matching frontend files in your GitHub Pages repository: `js/app.js` and `css/style.css`.
2. Open the Apps Script project connected to your existing Google Sheet. Replace the contents of the API module file with `apps-script/Api.gs` (keep your other Apps Script files unchanged).
3. Deploy Apps Script as a **New version** of the existing Web App deployment. Keep the same access settings and deployment URL.
4. Commit and push the frontend files to GitHub Pages.
5. Hard refresh the site (Ctrl+F5) and test: log 5 sets of 20 push-ups for a 5 × 20 target. Dashboard should show 100/100 reps and Completed.

## Completion rules
- Numeric rep targets: requires both target set count and total target reps. Example 5 × 20 = 100 reps.
- Duration-style targets such as `30 sec`: set completion is based on reaching the target number of logged sets because duration targets are not numeric reps.
- `Finish workout` still closes the workout session; it does not manually mark the daily routine complete.

## Notes
- The package preserves the existing Cloudflare Worker, config, PWA manifest, service worker, icons, and HTML from the supplied project snapshot.
- No secrets or bridge tokens are included in this update.
