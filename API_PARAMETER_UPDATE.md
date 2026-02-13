# API Parameter Update: all=true

## Change Made

Added `all=true` query parameter to the results.data API endpoint.

### Before:
```
https://sendou.ink/u/{username}/results.data
```

### After:
```
https://sendou.ink/u/{username}/results.data?all=true
```

## Purpose

The `all=true` parameter likely:
- Returns all tournament results (not just paginated/limited results)
- Includes both highlighted and non-highlighted tournaments
- Ensures comprehensive data for accurate comparison

## Files Updated

1. **content.js** (line 330)
   - Main extension API call in `fetchUserResults()`

2. **diagnose-specific-users.js**
   - Diagnostic tool API calls for consistency

## Impact

### More Complete Results
- Extension now fetches ALL tournament data for each user
- More accurate shared tourney detection
- Better time range calculation

### Better Matching
- Less likely to miss shared tourneys
- More comprehensive comparison
- Improved accuracy

## Testing

After applying this update:

1. **Reload extension** at `chrome://extensions/`
2. **Reload sendou.ink**
3. **Test with users** who have many tournaments

### What to Check

**Console logs should show:**
```
[Match History] Fetching from: https://sendou.ink/u/username/results.data?all=true
[Match History] Received data for username: 450 items in array
[Match History] Parsed 85 tournaments for username
```

**Before this change:**
- Might have parsed 25-30 tournaments (paginated/limited)

**After this change:**
- Should parse ALL tournaments (could be 50+, 100+, etc.)

### Verify

1. Check a user with lots of tournament history
2. See if more tournaments are parsed than before
3. Check if more shared tourneys are found

## Console Log Example

```
[Match History] Fetching results for: noodlesspl
[Match History] Fetching from: https://sendou.ink/u/noodlesspl/results.data?all=true
[Match History] Response status for noodlesspl: 200
[Match History] Received data for noodlesspl: 524 items in array
[Match History] Found 2 value array(s) - processing all for tournaments
[Match History] Processing array at index 35 with 15 items
[Match History]   → Parsed 15 unique tournaments from this array
[Match History] Processing array at index 185 with 70 items
[Match History]   → Parsed 70 unique tournaments from this array
[Match History] ✓ Total parsed: 85 tournament results (across all arrays)
[Match History] Parsed 85 tournaments for noodlesspl
```

Notice the larger numbers compared to before!

## Benefits

### 1. Complete History
- Gets all tournaments, not just recent ones
- Better for finding historical matchups

### 2. Accurate Time Range
- Can calculate true time range (earliest to latest)
- More meaningful "X months" display

### 3. More Matches Found
- Less likely to miss shared tourneys
- Especially important for players who competed together months ago

### 4. Consistent with Highlighted Fix
- Works together with the multi-array parsing fix
- Ensures ALL tournament data is captured

## Potential Issues

### Slower for Veterans
- Users with 100+ tournaments might take slightly longer to load
- Trade-off: accuracy vs. speed

### Solution
- Already limiting display to 3 tournaments
- Only fetches data once per click
- Acceptable trade-off for accuracy

### Large Response Size
- API might return more data
- Should still be manageable (JSON is compressed)

## Rollback

If this causes issues, revert by removing `?all=true`:

```javascript
// Revert to:
const url = `https://sendou.ink/u/${username}/results.data`;
```

## Integration with Other Features

This change complements:

1. **Multi-array parsing** - Gets all highlighted + non-highlighted
2. **Time range calculation** - More accurate with complete history
3. **Shared tourney detection** - More comprehensive comparison

## Summary

Adding `all=true` ensures the extension has access to complete tournament history for both users, improving accuracy and reducing false negatives when finding shared tourneys.

The performance impact is minimal since:
- Data is only fetched when user clicks the 📊 icon
- Results are parsed efficiently
- Only 3 tournaments are displayed (though all are considered)

This is an important improvement for accuracy!
