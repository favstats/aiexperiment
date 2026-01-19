# Circl

A social media feed simulation platform for research experiments.

## Overview

Circl provides two interfaces:

- **Admin Interface** (`index.html`) - For researchers to browse conditions, run QC on images, and test the experience mode
- **Participant Interface** (`feed.html`) - A clean social media feed for study participants, configured via URL parameters

## Participant Feed URL Parameters

To create a participant feed, navigate to `feed.html` with the following URL parameters:

| Parameter | Values | Description | Example |
|-----------|--------|-------------|---------|
| `age` | `18-29`, `30-44`, `45-59`, `60+` | Participant's age group | `age=30-44` |
| `gender` | `male`, `female` | Participant's gender | `gender=female` |
| `issue` | See below | Policy issue of interest | `issue=purchasing_power` |
| `politics` | `0-10` | Political leaning (0-4 = left, 5 = center, 6-10 = right) | `politics=3` |
| `total_posts` | `10-100` | Total number of posts to show (default: 40) | `total_posts=50` |
| `debug` | `T`, `true`, or `1` | Enable debug mode with view tracking (optional) | `debug=T` |

### Available Policy Issues

| Value | Display Name |
|-------|--------------|
| `Affordable_childcare_access` | Affordable childcare (access) |
| `Build_more_homes_accelerate_construction` | Build more homes |
| `CO2_levy_for_industry_climate` | CO₂ levy for industry |
| `purchasing_power` | Strengthen purchasing power |
| `stop_weapon_ship_to_israel` | Stop weapon shipments to Israel |

### Example URLs

**Basic participant feed:**
```
feed.html?age=18-29&gender=female&issue=purchasing_power&politics=3
```

**With debug mode enabled:**
```
feed.html?age=30-44&gender=male&issue=CO2_levy_for_industry_climate&politics=7&debug=T
```

**With custom post count:**
```
feed.html?age=60+&gender=female&issue=Affordable_childcare_access&politics=2&total_posts=25
```

## How It Works

1. **Loading Screen** - A smooth loading animation with rotating messages
2. **Feed Generation** - Creates a mix of:
   - Placeholder posts (regular social media content)
   - 1 AI-generated post tailored to the participant's demographics and issue
   - 3 AI-generated posts with randomized conditions
3. **URL Clearing** - After loading, URL parameters are cleared to prevent tampering
4. **Interaction Tracking** - Users can like, comment, and share posts
5. **Debug Mode** - When enabled, shows:
   - Labels indicating tailored vs random AI posts
   - Live view time tracking per post
   - Results button to see top 5 most-viewed posts

## File Structure

```
circl/
├── index.html          # Admin/researcher interface
├── feed.html           # Participant interface
├── css/
│   └── circl.css       # Shared styles
├── js/
│   ├── circl-core.js   # Shared functionality
│   ├── circl-admin.js  # Admin-specific logic
│   └── circl-feed.js   # Participant feed logic
└── README.md           # This file
```

## Running Locally

From the project root directory:

```bash
python3 -m http.server 8888
```

Then access:
- Admin: `http://localhost:8888/circl/index.html`
- Participant: `http://localhost:8888/circl/feed.html?age=18-29&gender=female&issue=purchasing_power&politics=5`
