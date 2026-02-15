# SAIL (Sandbox for AI Intervention & Labeling) Tracker — Google Sheets Setup Guide

One-time setup to collect participant tracking data in a Google Sheet.

## Step 1: Create Your Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "SAIL Study Data - [Your Study Name]"

## Step 2: Add the Apps Script

1. In your new Sheet, click **Extensions > Apps Script**
2. Delete any existing code in the editor
3. Copy the entire contents of `Code.gs` (from this folder) and paste it in
4. Click the **Save** icon (or Ctrl+S)
5. In the function dropdown at the top, select `setup`
6. Click **Run**
7. You'll be asked to authorize the script:
   - Click "Review permissions"
   - Choose your Google account
   - Click "Advanced" > "Go to SAIL Tracker (unsafe)" (this is safe — it's your own script)
   - Click "Allow"
8. You should see a confirmation message that headers were added

## Step 3: Deploy as Web App

1. In Apps Script, click **Deploy > New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Set the following:
   - **Description**: "SAIL Tracker"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
4. Click **Deploy**
5. **Copy the Web app URL** (it looks like `https://script.google.com/macros/s/AKfyc.../exec`)

## Step 4: Configure SAIL

1. Open `shared/sail-config.json` in your SAIL project
2. Paste the URL:
   ```json
   {
     "google_sheets_url": "https://script.google.com/macros/s/AKfyc.../exec",
     "study_id": "your-study-id"
   }
   ```
3. Push to GitHub Pages (or restart your local server)

## Step 5: Test

1. Open any SAIL platform with test parameters:
   ```
   /circl/feed.html?pid=test123&sid=demo&debug=T
   ```
2. Scroll through the feed, interact with posts
3. Check your Google Sheet — data should appear within 30 seconds

## Data Format

Each row in the Sheet contains one event:

| Column | Description |
|--------|-------------|
| `pid` | Participant ID (from Qualtrics or URL) |
| `sid` | Session/Study ID |
| `cond` | Experimental condition |
| `study_id` | Study identifier |
| `platform` | Which platform (circl, wave, flow, etc.) |
| `timestamp` | ISO 8601 timestamp |
| `elapsed_ms` | Milliseconds since session start |
| `event_type` | Type of event (session_start, like, post_view_end, etc.) |
| `event_data` | JSON object with event-specific details |

## Capacity

- Free tier: ~20,000 POST requests/day
- Each Sheet: up to 10 million cells
- Typical study (100 participants x 500 events): ~50,000 rows — well within limits

## Troubleshooting

- **No data appearing?** Check that `sail-config.json` has the correct URL
- **"Script authorization required"?** Re-run the `setup()` function and re-authorize
- **Quota errors?** You've hit the daily Apps Script limit. Data is buffered in sessionStorage and will be saved to the Sheet on the next successful flush.
- **Need to redeploy?** After code changes, go to Deploy > Manage deployments > Edit > Update version > Deploy
