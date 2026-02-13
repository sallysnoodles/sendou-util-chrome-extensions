# Quick Installation Guide

## Step 1: Generate Icons

1. Open `generate-icons.html` in your browser
2. Click "Download icon16.png", "Download icon48.png", and "Download icon128.png"
3. Move the downloaded files to the `icons/` folder

**OR** use any image editor to create three PNG files (16x16, 48x48, 128x128) and name them accordingly.

## Step 2: Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `sendou-match-history-extension` folder
5. The extension should now appear in your extensions list

## Step 3: Test on Sendou.ink

1. Go to [https://sendou.ink](https://sendou.ink)
2. Log in to your account
3. Navigate to any page with user profiles
4. Look for the 📊 icon next to usernames
5. Click it to see the match history

## Step 4: Customize for Real Use

⚠️ **Important**: This extension uses placeholder API calls. You need to:

1. Read `CUSTOMIZATION_NOTES.md` thoroughly
2. Inspect sendou.ink's actual API using Chrome DevTools
3. Update the API endpoints in `content.js`
4. Test and verify the data is displaying correctly

## Troubleshooting

**Extension not loading:**
- Make sure all files are in the correct location
- Check for error messages in `chrome://extensions/`
- Verify manifest.json is valid JSON

**Icons not showing:**
- Generate and place icon files in the `icons/` folder
- Or temporarily comment out icon references in manifest.json

**No match data:**
- Open DevTools Console (F12) and check for errors
- Verify you're logged in to sendou.ink
- Update API endpoints as described in CUSTOMIZATION_NOTES.md

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Sendou.ink Match History"
3. Click "Remove"

## Next Steps

- Customize the extension (see CUSTOMIZATION_NOTES.md)
- Test thoroughly on different pages
- Report issues or improvements
