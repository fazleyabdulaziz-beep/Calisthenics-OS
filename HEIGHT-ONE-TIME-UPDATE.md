# Height one-time save update

## What changed
- Height now has its own **Save Height** action and is stored once in the user's `Profiles.height_cm` field.
- Daily weight has a separate **Save today's weight** action and is stored in `WeightLogs` by Singapore date.
- Saving weight no longer requires sending height; BMI is calculated from the saved profile height and latest weight.
- Users can update height later if needed.

## Deployment
1. Replace the frontend files in your GitHub Pages repository with this package and push the changes.
2. In Google Apps Script, replace the API source with `apps-script/Api.gs`.
3. Deploy the Apps Script project as a **New version** of the existing Web App deployment.
4. Refresh the app and test **Save Height** independently, then save today's weight.

The source files passed JavaScript syntax checks. Live Google Sheets / Worker integration still needs to be tested in your deployment.
