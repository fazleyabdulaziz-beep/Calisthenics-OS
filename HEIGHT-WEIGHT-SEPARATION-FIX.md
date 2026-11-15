# Height & Weight Separation Fix

## What changed
- Height and Daily Weight now render as two completely separate cards/forms.
- Saving Height only calls `saveHeight` and writes `height_cm` to the user's `Profiles` row.
- Saving Weight only calls `saveBodyMetrics` and writes to `WeightLogs`.
- The Height save operation no longer uses the generic profile update helper; it locates the user's `Profiles` row by `user_id` and updates only `height_cm` and `updated_at`.
- BMI continues to use the saved profile height and latest daily weight.

## Deployment
1. Replace the frontend files in the GitHub Pages repository (`index.html`, `js/`, `css/`, and the other project assets/config files) with this package.
2. In Apps Script, replace the API module with `apps-script/Api.gs`.
3. Deploy Apps Script as a **New version** and ensure the Cloudflare Worker still points to the correct Apps Script deployment URL.
4. Hard refresh the app (Ctrl + Shift + R) or clear the site's cached files.
5. Test `Save height` while leaving Weight blank. Then test `Save today's weight` independently.

## Note
The code passed JavaScript syntax checks and the archive was checked for ZIP integrity. A live write to your Google Sheet cannot be verified from this environment.
