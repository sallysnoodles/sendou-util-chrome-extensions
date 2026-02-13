# Latest Changes

## Updates Applied

### 1. ✅ Show Both Players' Placements

**Before:**
- Only showed "You: #1" placement

**After:**
- Shows **"You: #X"** in purple/blue gradient
- Shows **"Them: #Y"** in orange/red gradient
- Both badges displayed side-by-side

**Example:**
```
Tournament Name
[You: #1] [Them: #3]
Date: Jan 15, 2026
```

### 2. ✅ Fixed Highlighted Tournaments Bug

**Problem:** Users with highlighted tournaments had non-highlighted tournaments ignored.

**Solution:** Parser now finds and processes ALL value arrays, not just the first one.

**Result:** All tournaments (highlighted + regular) are now included in comparisons.

### 3. ✅ Updated Tournament URLs

**Before:** `https://sendou.ink/tournament/3268`

**After:** `https://sendou.ink/to/3268/results`

Links now go directly to the results page.

## Visual Changes

### Placement Badge Colors

**Your placement:**
- Purple/blue gradient (#667eea → #764ba2)
- Label: "You: #X"

**Their placement:**
- Orange/red gradient (#f59e0b → #ef4444)
- Label: "Them: #Y"

### Layout

```
┌─────────────────────────────────────┐
│ Octopi Palooza! #11                │
│ [You: #1] [Them: #3]               │
│ Jan 15, 2026                        │
└─────────────────────────────────────┘
```

## How to Apply

1. Go to `chrome://extensions/`
2. Click refresh 🔄 on the extension
3. Reload sendou.ink
4. Click any 📊 icon

## What You'll See

When you open a match history block:

**Working correctly:**
```
Last 3 common tournaments

Milkcup #7
[You: #20] [Them: #5]
Dec 15, 2025

Octopi Palooza! #11
[You: #1] [Them: #3]
Jan 6, 2026

FLUTI 7
[You: #3] [Them: #8]
Jan 8, 2026
```

**If one player has no placement data:**
```
Tournament Name
[You: #1]
Date
```

**If neither has placement data:**
```
Tournament Name
(no placement badges shown)
Date
```

## Console Logs

With debug mode, you'll now see:

```
[Match History] ✓ Common tournament found: 3268 - Octopi Palooza! #11 (You: #1, Them: #3)
```

This shows both placements in the log.

## Testing Checklist

- [ ] Reload extension
- [ ] Reload sendou.ink
- [ ] Click 📊 icon next to a user
- [ ] Verify both "You" and "Them" badges appear
- [ ] Verify different colors (purple vs orange)
- [ ] Click tournament link
- [ ] Verify it goes to `/to/{id}/results` page
- [ ] Test with user who has highlighted tournaments
- [ ] Verify all tournaments are found (not just highlighted)

## Files Changed

1. **content.js**
   - Updated `findCommonTournaments()` to store both placements
   - Updated `renderMatches()` to display both badges
   - URL format changed to `/to/{id}/results`

2. **styles.css**
   - Added `.match-placements` flex container
   - Split `.placement-badge` into `.placement-you` and `.placement-them`
   - Different gradient colors for each

3. **diagnose-specific-users.js**
   - Updated URL format in diagnostic output

## Known Behavior

- If a player doesn't have a placement recorded, their badge won't show
- Both badges always visible when both players have placements
- Badges wrap to next line on very narrow screens
- Colors are distinct enough to tell apart at a glance

## Example Output in Console

```
[Match History] Found 2 value array(s) - processing all for tournaments
[Match History] Processing array at index 35 with 5 items
[Match History]   → Parsed 5 unique tournaments from this array
[Match History] Processing array at index 128 with 20 items
[Match History]   → Parsed 20 unique tournaments from this array
[Match History] ✓ Total parsed: 25 tournament results (across all arrays)
[Match History] User yourUsername: 25 tournaments
[Match History] User otherUser: 22 tournaments
[Match History] ✓ Common tournament found: 3268 - Octopi Palooza! #11 (You: #1, Them: #3)
[Match History] ✓ Common tournament found: 3193 - Milkcup #7 (You: #20, Them: #5)
[Match History] Found 2 common tournaments
```

This shows everything is working correctly!
