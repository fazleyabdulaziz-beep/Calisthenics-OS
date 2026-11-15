# BMI & Daily Body Weight Update

## What's included
- New **BMI & Body weight** section in the sidebar.
- Height is saved to the user's `Profiles.height_cm` field.
- Daily weight entries are saved to a `WeightLogs` sheet.
- The backend creates `WeightLogs` automatically on first use with these headers:
  `user_id | log_date | weight_kg | created_at`
- One entry per user per Singapore calendar day. Saving again on the same day updates that day's value rather than creating a duplicate.
- BMI is calculated from the latest recorded weight and saved height.
- A trend chart shows up to the latest 30 daily entries; the table shows the latest 10.
- Weight records are separated by user account.

## Install
1. Back up your current repository and Apps Script project.
2. Replace the frontend `index.html`, `js/app.js`, and `css/style.css` with the files in this ZIP.
3. Open the Apps Script project connected to the same Google Spreadsheet used by the current app.
4. Replace/update the API module using `apps-script/Api.gs` (keep the rest of your existing project files and helper functions).
5. Save and deploy the Apps Script Web App as a **New version**. Keep the existing deployment URL if updating the existing deployment.
6. Push the frontend changes to GitHub Pages.
7. Sign in, open **BMI & Body weight**, enter height once and today's weight. The `WeightLogs` sheet is created automatically.

## Notes
- Weight is in kilograms; height is in centimetres.
- BMI is a general screening measure, not a diagnosis. Adult BMI categories are not suitable for interpreting children's growth.
- The chart needs at least one saved entry. A trend becomes more meaningful after multiple daily records.
- This update has been syntax-checked locally, but the live Apps Script deployment and Google Sheet permissions must still be tested in your account.
