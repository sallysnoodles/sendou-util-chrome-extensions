# Recent Updates

## Changes Made (Latest Version)

### 1. ✅ No More Header/Footer Detection
**Problem:** The extension was picking up usernames from header/footer/nav, which could be wrong (e.g., profile page owner instead of logged-in user).

**Solution:**
- ❌ Removed detection from `<header>`, `<footer>`, and `<nav>` tags
- ✅ Only checks localStorage/sessionStorage first
- ✅ Falls back to specific user menu patterns
- ✅ 📊 icons only appear next to users in main content, NOT in navigation

### 2. ✅ Toggle to Close
**Status:** Already implemented!

The extension already supports clicking to toggle:
- Click 📊 → Opens match history
- Click 📊 again → Closes match history
- Visual feedback: Icon rotates 180° and glows when active

**Styling improvement:** Added rotation and glow effect to make it more obvious when open.

### 3. ✅ Manual Username Setting
**New Feature:** You can now manually set your username if auto-detection fails.

**How to use:**
1. Click the extension icon (📊) in Chrome toolbar
2. Enter your sendou.ink username
3. Click "Save Username"
4. Reload sendou.ink

**Alternative (Console):**
```javascript
chrome.storage.local.set({ manualUsername: "yourUsername" })
```

### 4. ✅ Better Debug Logging
All logs now prefixed with `[Match History]` and show:
- User detection status
- API fetch progress
- Number of tournaments found
- Any errors that occur

## How to Update

1. Go to `chrome://extensions/`
2. Find "Sendou.ink Match History"
3. Click the refresh icon 🔄
4. Reload any open sendou.ink tabs

## Testing the Updates

### Test 1: Username Detection
1. Open sendou.ink (logged in)
2. Press F12 → Console
3. Look for: `[Match History] ✓ Found logged-in user via storage: yourUsername`
4. If it shows your correct username → ✅ Working!

### Test 2: No Header/Footer Icons
1. Go to any sendou.ink page
2. Check header and footer
3. There should be NO 📊 icons in header/footer/nav
4. Only in main content area → ✅ Working!

### Test 3: Toggle Functionality
1. Click a 📊 icon → Opens
2. Click the same 📊 icon again → Closes
3. Icon should rotate when open → ✅ Working!

### Test 4: Manual Username
1. Click extension icon in toolbar
2. Enter your username
3. Click "Save Username"
4. Reload sendou.ink
5. Check console for: `[Match History] ✓ Using manually set username: yourUsername`

## Expected Behavior

### Where 📊 Icons Appear
✅ **YES - Should appear:**
- Next to usernames in tournament brackets
- Next to usernames in match results
- Next to usernames in player lists
- Next to usernames in tournament rosters

❌ **NO - Should NOT appear:**
- In the site header
- In the site footer
- In navigation menus
- Next to your own username

### Username Detection Priority
1. **Manual setting** (if you set it via popup)
2. **localStorage/sessionStorage** (automatic)
3. **User menu links** (fallback)

## Troubleshooting

### Still showing "No matches found"?

**Check these in Console (F12):**

```
[Match History] ✓ Found logged-in user via storage: yourUsername
[Match History] Loading match history for: otherUser
[Match History] User yourUsername: 25 tournaments
[Match History] User otherUser: 18 tournaments
[Match History] Found 3 common tournaments
```

**If you see:**
- `✗ Could not detect logged-in user` → Use manual username setting
- `Found 0 common tournaments` → You genuinely don't have common tournaments

### Wrong username detected?

**Solution:**
1. Click extension icon
2. Enter correct username manually
3. Save and reload

### Icons in wrong places?

Make sure you reloaded the extension after updating:
1. `chrome://extensions/`
2. Click refresh 🔄
3. Reload sendou.ink

## Debug Commands

Run these in Console (F12) on sendou.ink:

```javascript
// Check what's in storage
chrome.storage.local.get(['manualUsername'], r => console.log(r))

// Set username manually
chrome.storage.local.set({ manualUsername: "yourUsername" })

// Clear manual username
chrome.storage.local.remove('manualUsername')

// Check localStorage
console.log('LocalStorage:', Object.keys(localStorage))
for (let key of Object.keys(localStorage)) {
  console.log(key, localStorage.getItem(key).substring(0, 100))
}
```

## What's Next?

If the extension is still unstable after these changes:
1. Check the Console logs and share them
2. Run `debug-logged-in-user.js` to see all available usernames
3. Use manual username setting as a reliable fallback

The manual username setting should make it 100% stable since you're explicitly telling it who you are!
