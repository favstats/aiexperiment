/**
 * SAIL (Sandbox for AI Intervention & Labeling) Tracker — Google Apps Script
 *
 * Receives event batches from sail-tracker.js and appends rows
 * to the active Google Sheet in tidy data format.
 *
 * One-time setup:
 *   1. Make a copy of the SAIL template Sheet
 *   2. Extensions > Apps Script > paste this code
 *   3. Run setup() once to create the header row
 *   4. Deploy > New deployment > Web app > "Anyone" > Deploy
 *   5. Copy the URL into shared/sail-config.json
 */

function setup() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.setName('SAIL Events');
  var headers = [
    'pid', 'sid', 'cond', 'study_id', 'platform',
    'timestamp', 'elapsed_ms', 'event_type', 'event_data'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  SpreadsheetApp.getUi().alert('Setup complete! Headers added to "SAIL Events" sheet.');
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var events = payload.events || [];
    if (events.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', rows: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SAIL Events');
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    }

    var rows = events.map(function (evt) {
      return [
        evt.pid        || '',
        evt.sid        || '',
        evt.cond       || '',
        evt.study_id   || '',
        evt.platform   || '',
        evt.timestamp  || '',
        evt.elapsed_ms || 0,
        evt.event_type || '',
        JSON.stringify(evt.event_data || {})
      ];
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', rows: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'SAIL Tracker endpoint is active. Use POST to submit events.'
  })).setMimeType(ContentService.MimeType.JSON);
}
