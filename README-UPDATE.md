# Calisthenics OS — BMI + Profile Update

## What's changed
- BMI response now includes a server-calculated BMI and per-entry BMI using saved profile height and latest weight.
- Profile and WeightLogs now consistently use the configured `CALISTHENICS_DB_ID` spreadsheet via `getDatabase_()`; they no longer rely on `getActiveSpreadsheet()`.
- Profile navigation and page added: display name, username, password, gender, date of birth / calculated age, religion, race/ethnicity, country, and height shortcut.
- Username change requires current password and checks uniqueness.
- Password change uses the existing PBKDF2 password hashing and requires current password.
- Profile fields are optional; personal information is private to the account.
- Profile sheet migration appends missing columns without deleting existing rows or columns.

## Deployment
1. Upload `apps-script/Api.gs`, `apps-script/Code.gs`, `apps-script/Auth.gs`, and `apps-script/Social.gs` into the same Google Apps Script project, replacing the existing module contents.
2. Confirm Script Properties still contain `CALISTHENICS_DB_ID` and `BRIDGE_SECRET`. Do not put secrets in GitHub.
3. Deploy Apps Script as a new version.
4. Deploy the updated `worker.js` to the existing Cloudflare Worker. This adds the `changeUsername` action to its allow-list.
5. Push the frontend files (`index.html`, `js/app.js`, `css/style.css`, plus existing static assets) to GitHub Pages.
6. Hard refresh the app (Ctrl+Shift+R), sign in, open Profile, save personal details, then test BMI by saving a weight.

## Notes
- Existing data is preserved. The first Profile read automatically adds missing Profile columns.
- Date of birth is used to calculate age on screen; age is also saved as a convenience field.
- This package has been syntax-checked and ZIP-integrity checked. Live Google Sheets / Cloudflare deployment has not been tested from this environment.
