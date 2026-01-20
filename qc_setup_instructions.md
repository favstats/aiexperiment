# Quality Control - Google Sheets Setup Instructions

This guide explains how to set up Google Sheets to receive annotation data from the Quality Control tool.

## Overview

The QC tool sends data to a Google Apps Script web app, which appends rows to a Google Sheet. This is a secure and free solution that doesn't require any API keys in your frontend code.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "AI Experiment QC Data"
3. In the first row, add these headers (in order):

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| timestamp | coder_id | condition_id | image_filename | no_weird_text | outgroup_present | looks_authentic | age_accurate | gender_accurate | suitable | image_quality | emotional_intensity | emotional_valence | notes |

4. Note your Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit`

## Step 2: Create the Apps Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Delete any existing code and paste this:

```javascript
function doPost(e) {
  try {
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Open the spreadsheet (use the active spreadsheet since script is bound to it)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Append the data as a new row
    sheet.appendRow([
      data.timestamp,
      data.coder_id,
      data.condition_id,
      data.image_filename,
      data.no_weird_text,
      data.outgroup_present,
      data.looks_authentic,
      data.age_accurate,
      data.gender_accurate,
      data.suitable,
      data.image_quality,
      data.emotional_intensity,
      data.emotional_valence,
      data.notes
    ]);
    
    // Return success
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify the script works
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        coder_id: "test_coder",
        condition_id: "test_condition",
        image_filename: "test_image.jpg",
        no_weird_text: "yes",
        outgroup_present: "no",
        looks_authentic: "yes",
        age_accurate: "yes",
        gender_accurate: "yes",
        suitable: "yes",
        image_quality: 4,
        emotional_intensity: 5,
        emotional_valence: "neutral",
        notes: "Test submission"
      })
    }
  };
  
  doPost(testData);
  Logger.log("Test row added to sheet");
}
```

3. Click **Save** (Ctrl+S or Cmd+S)
4. Name the project "QC Data Receiver"

## Step 3: Deploy the Web App

1. Click **Deploy > New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Configure:
   - **Description**: "QC Data Receiver v1"
   - **Execute as**: "Me" (your account)
   - **Who has access**: "Anyone"
4. Click **Deploy**
5. **Authorize the app** when prompted (click through the "unsafe" warnings - this is your own script)
6. **Copy the Web App URL** - it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

## Step 4: Configure the QC Tool

1. Open `index.html` in your code editor
2. Find this section near the bottom:

```javascript
const QC_CONFIG = {
  googleScriptUrl: ''
};
```

3. Paste your Web App URL:

```javascript
const QC_CONFIG = {
  googleScriptUrl: 'https://script.google.com/macros/s/AKfycbx.../exec'
};
```

4. Save the file

## Step 5: Test It

1. Reload the QC tool in your browser
2. Enter a Coder ID
3. Fill out the form for an image
4. Click "Submit & Next"
5. Check your Google Sheet - you should see a new row!

## Troubleshooting

### Data not appearing in Sheet?

1. **Check the URL**: Make sure you copied the full URL including `/exec`
2. **Re-deploy**: If you made changes to the script, you need to deploy a NEW version:
   - Deploy > Manage deployments > Create new deployment
3. **Check permissions**: Make sure "Who has access" is set to "Anyone"

### "Error saving" message?

- Data is still saved locally in your browser (localStorage)
- Check browser console for detailed error messages
- The `no-cors` mode means we can't read the response, but data still goes through

### How to export local backup?

Open browser console (F12) and run:
```javascript
exportQCData()
```

This downloads a JSON file with all locally stored QC data.

## Security Notes

- The Apps Script URL is visible in your HTML source, but this is acceptable because:
  - The data is not sensitive (just quality ratings)
  - The Sheet is append-only (no one can read existing data via the URL)
  - Google rate-limits the endpoint automatically
  
- For additional security, you can add a simple passphrase:

```javascript
// In Apps Script:
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.passphrase !== 'your_secret_phrase') {
    return ContentService.createTextOutput('Unauthorized');
  }
  // ... rest of code
}

// In index.html, add to data object:
data.passphrase = 'your_secret_phrase';
```

## Data Schema

Each submission contains:

| Field | Type | Description |
|-------|------|-------------|
| timestamp | ISO string | When the annotation was made |
| coder_id | string | ID of the person doing the coding |
| condition_id | string | Full condition identifier |
| image_filename | string | Specific image file |
| no_weird_text | yes/no/unclear | No garbled AI text |
| outgroup_present | yes/no/unclear | Outgroup members visible |
| looks_authentic | yes/no/unclear | Doesn't look obviously AI |
| age_accurate | yes/no/unclear | Age matches condition |
| gender_accurate | yes/no/unclear | Gender matches condition |
| suitable | yes/no/unclear | Overall suitable for experiment |
| image_quality | 1-5 | Star rating |
| emotional_intensity | 0-10 | How intense the image feels |
| emotional_valence | very_negative to very_positive | Emotional tone |
| notes | string | Free-text observations |















