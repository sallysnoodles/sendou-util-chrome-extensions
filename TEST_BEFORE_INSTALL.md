# 🧪 Test Before Installing

Follow these steps to test if the extension will work **before** installing it.

## Why Test First?

Testing helps you verify:
- ✅ The API parser works correctly
- ✅ You can find common tournaments with other users
- ✅ The data structure is being read properly

## Step-by-Step Test Instructions

### 1. Open Sendou.ink

Go to: https://sendou.ink

**Important:** You MUST be on sendou.ink itself, not a local file!

### 2. Open Developer Tools

Press **F12** (or **Cmd+Option+I** on Mac)

### 3. Go to Console Tab

Click on the **Console** tab in DevTools

### 4. Load the Test Script

1. Open the file `test-in-browser.js` in a text editor
2. **Copy ALL the contents** (Cmd+A or Ctrl+A, then Cmd+C or Ctrl+C)
3. **Paste into the Console** (Cmd+V or Ctrl+V)
4. **Press Enter**

### 5. Watch the Results

You should see output like:

```
=== Sendou.ink API Parser Test ===

📊 Testing user: noodlesspl
✓ API response received (424 items)
✓ Parsed 79 tournaments

📋 First 5 tournaments:
1. Octopi Palooza! #11
   ID: 3268 | Placement: 1
   Date: 1/6/2026
   URL: https://sendou.ink/tournament/3268

2. Milkcup #7
   ID: 3193 | Placement: 20
   ...
```

### 6. Interpret the Results

**✅ SUCCESS:** If you see tournaments listed with IDs and names
- The parser is working!
- You're ready to install the extension

**❌ FAILED:** If you see errors or "0 tournaments"
- Something went wrong
- Check the error messages in red
- See Troubleshooting section below

## Additional Tests

### Test Your Own Username

Find your username first:
```javascript
document.querySelector('nav a[href*="/u/"]')?.href.match(/\/u\/([^\/]+)/)?.[1]
```

Then test it:
```javascript
await testUser('yourUsername')
```

### Test Common Tournaments

Find tournaments you share with another user:
```javascript
await testCommonTournaments('noodlesspl', 'yourUsername')
```

Expected output:
```
🤝 Finding common tournaments between noodlesspl and yourUsername
...
✅ Found 3 common tournaments!

🏆 Common tournaments:
1. Tournament Name
   ID: 1234 | Placement: 1
   ...
```

## Troubleshooting

### "Failed to load response data" or CORS error
- ❌ You're not on sendou.ink
- ✅ Solution: Make sure you're on https://sendou.ink, not a local file

### "Failed to fetch"
- The API might be down
- Check if sendou.ink is accessible
- Try refreshing the page

### "Parsed 0 tournaments"
- The user might not have any tournament results
- Try a different username like "noodlesspl"
- Check if the API response format changed

### "undefined" or no output
- Make sure you copied the ENTIRE script
- Check for JavaScript errors in the console
- Try pasting the script again

## What Next?

**If the test passed:**
1. Follow `QUICK_START.md` to install the extension
2. The extension will work the same way as this test!

**If the test failed:**
1. Check the error messages
2. Make sure you're on sendou.ink (not a local file)
3. Try with different usernames
4. Check if the API structure changed

## Understanding the Output

```javascript
{
  tournamentId: 3268,          // Unique tournament ID
  eventName: "Octopi Palooza!", // Tournament name
  startTime: 1770944400,        // Unix timestamp
  placement: 1,                 // Your placement
  logoUrl: "https://..."        // Tournament logo
}
```

The extension uses this data to:
1. Find tournaments both users participated in
2. Show the last 3 common tournaments
3. Display tournament names with links
4. Show your placement

## Video Walkthrough Alternative

If you're stuck, here's what should happen:

1. You go to sendou.ink
2. Press F12
3. Click Console
4. Paste the test script
5. Press Enter
6. See tournament data appear

If this doesn't work, there might be an issue with the API or your browser.

## Ready to Install?

Once the test passes, go to `QUICK_START.md` Step 3 to install the extension!
