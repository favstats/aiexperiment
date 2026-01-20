# Circl

A social media feed simulation platform for research experiments.

## Overview

Circl provides two interfaces:

- **Admin Interface** (`index.html`) - For researchers to browse conditions, run QC on images/texts, and test the experience mode
- **Participant Interface** (`feed.html`) - A clean social media feed for study participants, configured via URL parameters

## Quick Start

From the project root directory:

```bash
python3 -m http.server 8888
```

Then access:
- Admin: `http://localhost:8888/circl/index.html`
- Participant: `http://localhost:8888/circl/feed.html?source=json&age=18-29&gender=female&issue=purchasing_power&politics=5`

## Data Configuration (JSON Files)

All feed content is configured via JSON files in the `data/` folder. This makes it easy for researchers to customize content without modifying code.

### `data/feed-config.json`

Controls overall feed behavior:

```json
{
  "feed_settings": {
    "total_posts": 40,
    "stimuli_count": 4,
    "filler_ratio": 4,
    "randomize_order": true,
    "first_n_fillers": 2
  },
  "personalization": {
    "enabled": true,
    "tailored_count": 1,
    "random_count": 3
  }
}
```

### `data/stimuli.json`

Contains experimental stimulus posts. Generated automatically by `generate_conditions_json.py` or can be created manually:

```json
{
  "posts": [
    {
      "id": "stim_18-29_female_issue_left_01",
      "type": "stimulus",
      "condition_id": "18-29_female_issue_left",
      "text": "Post text content...",
      "image": {
        "src": "../generated_images/condition/image_01.jpg",
        "alt": "Description"
      },
      "author": {
        "name": null,
        "gender": "female",
        "age_group": "18-29",
        "avatar_url": null
      },
      "metadata": {
        "ideology": "left",
        "policy_issue": "issue_name",
        "image_index": 0
      }
    }
  ]
}
```

### `data/fillers.json`

Contains filler/distractor posts to mix with stimuli:

```json
{
  "posts": [
    {
      "id": "filler_001",
      "type": "filler",
      "subtype": "person",
      "text": "Wat een heerlijk weer vandaag! ☀️",
      "image": {
        "src": "https://picsum.photos/seed/abc/600/400",
        "show": true
      },
      "author": {
        "name": "Emma de Vries",
        "gender": "female",
        "age_group": "30-44",
        "avatar_url": null
      },
      "engagement": null,
      "time": null
    }
  ]
}
```

**Field behavior:**
- Fields set to `null` are automatically randomized (engagement, time, author name)
- `author.avatar_url: null` generates an age/gender-appropriate avatar
- `subtype: "organization"` uses logo/icon instead of avatar

## Participant Feed URL Parameters

Navigate to `feed.html` with these URL parameters:

| Parameter | Values | Description | Example |
|-----------|--------|-------------|---------|
| `source` | `json` | Use JSON-based feed (recommended) | `source=json` |
| `age` | `18-29`, `30-44`, `45-59`, `60+` | Participant's age group | `age=30-44` |
| `gender` | `male`, `female` | Participant's gender | `gender=female` |
| `issue` | See below | Policy issue of interest | `issue=purchasing_power` |
| `politics` | `0-10` | Political leaning (0-4=left, 5=center, 6-10=right) | `politics=3` |
| `total_posts` | `10-100` | Total number of posts (default: 40) | `total_posts=50` |
| `debug` | `T`, `true`, `1` | Enable debug mode with view tracking | `debug=T` |

### Available Policy Issues

| Value | Display Name |
|-------|--------------|
| `Affordable_childcare_access` | Affordable childcare (access) |
| `Build_more_homes_accelerate_construction` | Build more homes |
| `CO2_levy_for_industry_climate` | CO₂ levy for industry |
| `purchasing_power` | Strengthen purchasing power |
| `stop_weapon_ship_to_israel` | Stop weapon shipments to Israel |

### Example URLs

**Basic participant feed with personalization:**
```
feed.html?source=json&age=18-29&gender=female&issue=purchasing_power&politics=3
```

**With debug mode (shows TAILORED/RANDOM badges and view times):**
```
feed.html?source=json&age=30-44&gender=male&issue=CO2_levy_for_industry_climate&politics=7&debug=T
```

## Quality Control (QC) Form

The admin interface includes a QC form for rating images and texts. Data is submitted to a Google Apps Script for storage.

### Setting Up Google Apps Script

1. Create a Google Sheet with these columns:

```
timestamp | coder_id | condition_id | image_id | text_id | image_filename | no_weird_text | looks_authentic | outgroup_image | outgroup_text | age_image | age_text | gender_image | gender_text | ideology_image | ideology_text | issue_image | issue_text | intensity_image | intensity_text | notes
```

2. Go to Extensions > Apps Script and paste:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.timestamp,
      data.coder_id,
      data.condition_id,
      data.image_id,
      data.text_id,
      data.image_filename,
      data.no_weird_text,
      data.looks_authentic,
      data.outgroup_image,
      data.outgroup_text,
      data.age_image,
      data.age_text,
      data.gender_image,
      data.gender_text,
      data.ideology_image,
      data.ideology_text,
      data.issue_image,
      data.issue_text,
      data.intensity_image,
      data.intensity_text,
      data.notes
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok'
  })).setMimeType(ContentService.MimeType.JSON);
}
```

3. Deploy as Web App (Execute as: Me, Access: Anyone)
4. Update the URL in `js/circl-admin.js` (`QC_CONFIG.googleScriptUrl`)

## How It Works

1. **Loading Screen** - Smooth animation with rotating messages
2. **Feed Generation** - Creates a mix of:
   - Filler posts (regular social media content from `fillers.json`)
   - 1 AI-generated post tailored to participant demographics (TAILORED)
   - 3 AI-generated posts with randomized conditions (RANDOM)
3. **URL Clearing** - Parameters are cleared after loading to prevent tampering
4. **Interaction Tracking** - Users can like, comment, and share posts
5. **Debug Mode** - Shows TAILORED/RANDOM badges and live view times

## File Structure

```
circl/
├── index.html              # Admin/researcher interface
├── feed.html               # Participant interface
├── css/
│   └── circl.css           # Shared styles
├── js/
│   ├── circl-core.js       # Shared functionality
│   ├── circl-admin.js      # Admin-specific logic
│   ├── circl-feed.js       # Participant feed logic
│   └── feed-loader.js      # JSON feed loading & processing
├── data/
│   ├── feed-config.json    # Feed behavior settings
│   ├── stimuli.json        # Experimental stimuli (auto-generated)
│   └── fillers.json        # Filler posts (editable)
└── README.md
```

## Generating Stimuli

To regenerate `stimuli.json` from generated images and texts:

```bash
python3 generate_conditions_json.py
```

This reads from:
- `generated_images/` - AI-generated images organized by condition
- `generated_texts/` - AI-generated texts in `texts.json` files

And outputs:
- `conditions.json` - Legacy format for admin interface
- `circl/data/stimuli.json` - New format for participant feed
