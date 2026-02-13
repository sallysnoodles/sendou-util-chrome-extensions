# Troubleshooting Guide

## Issue: "No matches found" appearing randomly

If the extension sometimes works and sometimes shows "No matches found between you and this user", follow these debugging steps:

### Step 1: Check if you're logged in

The most common cause is **inconsistent logged-in user detection**.

1. **Are you logged in to sendou.ink?**
   - The extension REQUIRES you to be logged in
   - Log out and log back in if unsure

2. **Run the debug script:**
   - Go to https://sendou.ink
   - Press F12 → Console
   - Open `debug-logged-in-user.js`
   - Copy ALL contents and paste into Console
   - Press Enter

3. **Check the output:**
   - Look for: `✅ Detected logged-in user: "yourUsername"`
   - If you see: `❌ Could not detect logged-in user`
     - You might not be logged in
     - Or the detection method needs updating

### Step 2: Enable Debug Mode (Already Enabled)

The extension now has debug mode ON by default. This shows detailed logs in the browser console.

1. Go to sendou.ink
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Click on a 📊 icon next to a username
5. **Watch the console logs**

You should see logs like:

```
[Match History] Loading match history for: someuser
[Match History] Comparing yourUsername vs someuser
[Match History] Fetching matches between yourUsername and someuser
[Match History] Fetching results for both users...
[Match History] Fetching results for: yourUsername
[Match History] Received data for yourUsername: 424 items
[Match History] Parsed 25 tournaments for yourUsername
[Match History] Fetching results for: someuser
[Match History] Received data for someuser: 380 items
[Match History] Parsed 20 tournaments for someuser
[Match History] User yourUsername: 25 tournaments
[Match History] User someuser: 20 tournaments
[Match History] Found 3 common tournaments
```

### Step 3: Interpret the Debug Output

#### ✅ Success Pattern:
```
[Match History] ✓ Found logged-in user via header: yourUsername
[Match History] Parsed 25 tournament results from API data
[Match History] Found 3 common tournaments
```

#### ❌ Problem: User not detected
```
[Match History] ✗ Could not detect logged-in user. Are you logged in?
[Match History] Cannot load match history - not logged in
```

**Solution:**
- Make sure you're logged in
- Run `debug-logged-in-user.js` to see where your username appears
- Update the `getLoggedInUser()` function in `content.js` if needed

#### ❌ Problem: Picking up wrong username
```
[Match History] ✓ Found logged-in user via header: wrongUser
[Match History] Comparing wrongUser vs otherUser
```

**Solution:**
This means the extension is detecting the wrong username. This can happen if:
- You're on someone else's profile page
- The nav link detection is picking up the profile owner, not you

Run `debug-logged-in-user.js` to see all the /u/ links and identify which one is yours.

#### ❌ Problem: API errors
```
[Match History] API returned 404 for someuser
```

**Solution:**
- The username might be incorrect
- The user might not exist
- Check the username spelling

#### ❌ Problem: Parsing errors
```
[Match History] Parsed 0 tournament results from API data
```

**Solution:**
- The API response format might have changed
- Run `test-in-browser-v2.js` to verify parsing still works
- The user might not have any tournament results

### Step 4: Common Issues and Solutions

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Please log in" every time | Not logged in to sendou.ink | Log in and refresh |
| Works on some pages, not others | User detection inconsistent | Run debug script, check logs |
| "No matches found" for users you've played against | Actually no common tournaments | Check if you were in same tournaments |
| Extension doesn't load at all | Installation issue | Reload extension at chrome://extensions |
| 📊 icons don't appear | Page not fully loaded | Refresh the page |

### Step 5: Manual Test

Test if the API itself is working:

1. Go to sendou.ink
2. Press F12 → Console
3. Run:
```javascript
fetch('/u/yourUsername/results.data')
  .then(r => r.json())
  .then(data => console.log('Your tournaments:', data))
```

4. Check if data is returned
5. If error, the API might be down or username is wrong

### Step 6: Compare Two Users Manually

```javascript
// Copy the test function from test-in-browser-v2.js
// Then run:
await testCommonTournaments('yourUsername', 'otherUsername')
```

This bypasses the extension and tests the API directly.

### Step 7: Disable Debug Mode (Optional)

Once everything is working, you can disable debug logging:

1. Open `content.js`
2. Find line 5: `this.DEBUG = true;`
3. Change to: `this.DEBUG = false;`
4. Save and reload the extension

### Step 8: Report Issues

If none of the above helps, gather this info:

1. **Console logs** when clicking a 📊 icon
2. **Output of `debug-logged-in-user.js`**
3. **Your username** (to test with)
4. **The other user's username** where it fails
5. **Whether you're logged in**
6. **What page you're on** when it fails

## Tips for Reliable Usage

1. **Stay logged in** - The extension needs this
2. **Refresh after logging in** - Ensure detection works
3. **Check console** if something seems wrong
4. **Test with known common tournaments** - Verify with users you know you've competed against

## Known Limitations

1. **Only shows tournaments, not individual matches**
   - The API only provides tournament participation
   - If both users were in a tournament, it shows

2. **"No matches found" might be accurate**
   - You genuinely might not have competed in the same tournaments
   - The extension can only find what exists in the data

3. **Username detection depends on page structure**
   - If sendou.ink updates their HTML, detection might break
   - Use the debug script to identify the new structure

## Quick Reference Commands

Run these in the Console on sendou.ink:

```javascript
// Check logged-in user detection
// (paste contents of debug-logged-in-user.js)

// Test API parsing
// (paste contents of test-in-browser-v2.js)

// Manual API test
await fetch('/u/yourUsername/results.data').then(r => r.json())

// Compare two users
await testCommonTournaments('user1', 'user2')
```
