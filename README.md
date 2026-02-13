# Sendou.ink Match History Extension

A Chrome extension that displays match history between you and other users on sendou.ink.

## Features

- 📊 Shows an expandable button next to every user on sendou.ink
- 🎯 Displays the most recent matches between you and that user, as friends or foe
- 🏆 Includes tournament names with direct links
- 🎨 Beautiful, modern UI with dark mode support
- ⚡ Fast and lightweight

## Installation

### Method 1: Load Unpacked (Development Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `sendou-match-history-extension` folder
6. The extension is now installed!

### Method 2: Create Icons (Optional)

The extension requires icon files. You can:

1. Create your own icons (16x16, 48x48, and 128x128 PNG files)
2. Place them in the `icons/` folder with the names:
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`
3. Or use an online icon generator to create placeholder icons

To create quick placeholder icons, run:
```bash
cd icons
# Create simple colored squares as placeholders
convert -size 16x16 xc:#667eea icon16.png
convert -size 48x48 xc:#667eea icon48.png
convert -size 128x128 xc:#667eea icon128.png
```

## Usage

1. Log in to [sendou.ink](https://sendou.ink/)
2. Navigate to any page with user profiles or usernames
3. Look for the 📊 icon next to usernames
4. Hover over the icon to view match history
5. Click on any match to navigate to that tournament page

## How It Works

The extension:
1. Detects when you're on sendou.ink
2. Identifies all user links on the page
3. Adds an expandable button next to each user
4. Fetches match data when you hover over the button
5. Displays tournament names with embedded links

## API Integration

This extension attempts to fetch match data from sendou.ink's API. You may need to:

1. **Check the actual API endpoints**: Inspect network requests on sendou.ink to find the correct API endpoints
2. **Update the API calls**: Modify `content.js` to match sendou.ink's actual API structure
3. **Handle authentication**: Add proper authentication headers if required

### Customizing API Calls

Edit the `fetchMatches()` function in `content.js`:

```javascript
async fetchMatches(username) {
  // Update this URL to match sendou.ink's actual API
  const response = await fetch(
    `https://sendou.ink/api/matches?user1=${this.loggedInUser}&user2=${username}&limit=3`
  );

  const data = await response.json();
  return data.matches || [];
}
```

## File Structure

```
sendou-match-history-extension/
├── manifest.json          # Extension configuration
├── content.js            # Main logic for detecting users and showing history
├── background.js         # Background service worker
├── styles.css            # Styling for the match history blocks
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Permissions

The extension requires:
- `storage`: To cache user preferences
- `https://sendou.ink/*`: To access sendou.ink pages and API

## Known Limitations

1. The extension assumes sendou.ink has a public API for match data
2. You may need to adjust the user detection logic based on sendou.ink's HTML structure
3. API endpoints are placeholders and need to be updated based on the actual sendou.ink API

## Troubleshooting

### Extension not showing up
- Make sure you're on a sendou.ink page
- Check that Developer Mode is enabled in Chrome
- Try reloading the extension

### No match history showing
- Verify you're logged in to sendou.ink
- Check the browser console for errors (F12 → Console)
- The API endpoints may need to be updated

### Icons not loading
- Create icon files as described in the Installation section
- Or temporarily remove icon references from `manifest.json`

## Development

To modify the extension:

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload the sendou.ink page to see changes

## Future Improvements

- [ ] Add win/loss indicators
- [ ] Show player stats comparison
- [ ] Add filtering options (by tournament type, date range)
- [ ] Cache match data to reduce API calls
- [ ] Add settings page for customization
- [ ] Support for team matches

## License

MIT License - Feel free to modify and distribute

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
