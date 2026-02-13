# 🚀 Quick Start Guide

## Step 1: Generate Icons (5 minutes)

1. Open `generate-icons.html` in your browser
2. Click the download buttons for all three icons
3. Move the downloaded files to the `icons/` folder

## Step 2: Test the API Parser (Optional but Recommended)

Before installing the extension, test if the API parser works:

1. **Go to [https://sendou.ink](https://sendou.ink)** (important - must be on the actual site)
2. **Press F12** to open DevTools
3. **Go to the Console tab**
4. **Copy the entire contents of `test-in-browser.js`**
5. **Paste into the console and press Enter**

The script will automatically test with the user "noodlesspl" and show results.

**To test with your own username:**
```javascript
await testCommonTournaments('noodlesspl', 'yourUsername')
```

If you see tournaments listed, the parser is working! ✅

**Why not use test-api-parser.html?**
That file can't access sendou.ink's API due to CORS (browser security). The console test bypasses this since you're on sendou.ink itself.

## Step 3: Install the Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select the `sendou-match-history-extension` folder
6. You should see the extension appear!

## Step 4: Test on Sendou.ink

1. Go to [https://sendou.ink](https://sendou.ink)
2. **Log in to your account** (required!)
3. Navigate to any page with usernames:
   - Tournament pages
   - User profiles
   - Leaderboards
4. Look for the 📊 icon next to usernames
5. Hover over it to see common tournaments

## What It Shows

The extension displays:
- **Last 3 common tournaments** between you and the other user
- **Tournament name** with a clickable link
- **Your placement** in that tournament
- **Tournament date**

## Troubleshooting

### No 📊 icons appearing
- Make sure you're on sendou.ink
- Check that the extension is enabled in `chrome://extensions/`
- Try refreshing the page
- Open DevTools Console (F12) and look for errors

### "Please log in to view match history"
- Make sure you're logged in to sendou.ink
- The extension can't detect your username

### "No matches found"
- This means you haven't competed in the same tournaments as that user
- Try checking different users you know you've competed against

### Extension won't load
- Make sure all files are in the folder
- Check that `manifest.json` is valid
- Make sure icons are in the `icons/` folder

### Data not loading or parsing errors
1. Open the `test-api-parser.html` file
2. Test with your username
3. Check the console for errors
4. The raw API response will show if there are parsing issues

## Debugging

**Enable detailed logging:**
1. Open the extension folder
2. Edit `content.js`
3. Add this at the top of the MatchHistoryExtension class:
```javascript
constructor() {
  this.DEBUG = true;  // Add this line
  this.loggedInUser = null;
  // ... rest of code
}
```
4. Reload the extension in `chrome://extensions/`
5. Check the browser console for detailed logs

**Check API calls:**
1. Open sendou.ink
2. Press F12 → Network tab
3. Filter by "Fetch/XHR"
4. Hover over a 📊 icon
5. You should see calls to `/u/{username}/results.data`
6. Check if they're successful (status 200)

## Next Steps

Once it's working:
- Use it to find rivals and check your match history
- Share it with friends
- Report issues or suggest improvements

## Known Limitations

1. **Only shows tournaments, not individual matches**
   - The API only provides tournament participation data
   - If both users competed in a tournament, it will show

2. **Requires login**
   - You must be logged in to sendou.ink
   - The extension needs your username to compare

3. **No win/loss data**
   - The API doesn't provide head-to-head match results
   - Only shows which tournaments both players attended

## Getting Help

If you're stuck:
1. Check the console for errors (F12)
2. Test with `test-api-parser.html`
3. Look at `CUSTOMIZATION_NOTES.md` for detailed info
4. Check the `README.md` for full documentation

## Enjoy!

Happy squiding! 🦑
