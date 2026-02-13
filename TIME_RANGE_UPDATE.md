# Time Range Update

## Changes Made

### Header Text Updated

**Before:**
```
Last 3 common tournaments
```

**After:**
```
3 common tournaments in the last 7 months
```

The header now shows:
1. **Number of tournaments** (not just "last 3")
2. **Time range** based on the shorter of the two players' history
3. **Capped at 12 months** maximum

## How It Works

### Time Range Calculation

1. **Get tournament history for both players**
   - User 1: Tournaments from Jan 2025 to Dec 2025 (12 months)
   - User 2: Tournaments from June 2025 to Dec 2025 (7 months)

2. **Take the shorter time range**
   - In this example: 7 months (User 2's shorter history)

3. **Cap at 12 months**
   - If both users have 2+ years of history, show "12 months"
   - This keeps the time range meaningful and recent

4. **Display in header**
   - "3 common tournaments in the last 7 months"

### Examples

**Example 1: Short history**
- You: 3 months of tournaments
- Them: 8 months of tournaments
- Result: "2 common tournaments in the last 3 months"

**Example 2: Long history, capped**
- You: 24 months of tournaments
- Them: 18 months of tournaments
- Result: "5 common tournaments in the last 12 months"

**Example 3: Very recent players**
- You: 1 month of tournaments
- Them: 2 months of tournaments
- Result: "1 common tournament in the last 1 month"

**Example 4: Equal history**
- You: 6 months of tournaments
- Them: 6 months of tournaments
- Result: "4 common tournaments in the last 6 months"

## Console Logs

With debug mode enabled, you'll see:

```
[Match History] yourUsername history: 12 months
[Match History] otherUser history: 7 months
[Match History] Using time range: 7 months (shorter of the two, capped at 12)
```

This helps you understand which player's history determined the time range.

## Edge Cases Handled

### No timestamps
- If tournaments have no timestamp data, defaults to 1 month
- Ensures header always shows a valid time range

### Single tournament
- "1 common tournament in the last 1 month"
- Uses singular "tournament" and "month"

### Very long history
- Capped at 12 months
- "8 common tournaments in the last 12 months"
- Focuses on recent competitive history

### Brand new player
- If player has tournaments all from same month
- Shows "X tournaments in the last 1 month"

## Technical Details

### Time Calculation

```javascript
calculateTimeRange(tournaments) {
  // Find earliest and latest tournament timestamps
  // Calculate difference in months
  // Round up to nearest month
  // Minimum 1 month
}
```

### Data Flow

1. `fetchMatches()` gets tournaments for both users
2. Calls `calculateTimeRange()` for each user
3. Takes `Math.min(range1, range2, 12)`
4. Returns object with:
   - `matches`: Array of common tournaments (max 3)
   - `totalCommon`: Total count of all common tournaments
   - `timeRangeMonths`: Calculated time range

5. `renderMatches()` receives time range
6. Generates appropriate header text

## Benefits

### More Informative
- Shows actual time context
- User knows if this is recent or historical data

### Accurate
- Based on actual tournament dates
- Not just arbitrary "last 3"

### Adaptive
- Adjusts based on player history
- Shorter history = shorter time range shown

### Professional
- More precise and meaningful metric
- Better UX for competitive players

## Testing

### Test Cases

1. **Both players with long history (>12 months)**
   - Expected: "X tournaments in the last 12 months"

2. **One player new, one veteran**
   - Expected: Uses new player's shorter time range

3. **Both players very new (<1 month)**
   - Expected: "X tournaments in the last 1 month"

4. **Players with no common tournaments**
   - Expected: "No common tournaments found..." (no header)

5. **Single common tournament**
   - Expected: "1 common tournament in the last X month"
   - (singular "tournament" and "month")

### Console Check

Look for these logs:
```
[Match History] yourUsername history: X months
[Match History] otherUser history: Y months
[Match History] Using time range: Z months (shorter of the two, capped at 12)
```

Where Z = min(X, Y, 12)

## Files Changed

1. **content.js**
   - Added `calculateTimeRange()` method
   - Updated `fetchMatches()` to calculate and return time range
   - Updated `renderMatches()` to accept and display time range
   - Updated `loadMatchHistory()` to use new result structure

## Examples in Action

```
┌──────────────────────────────────────┐
│ 3 common tournaments in the last    │
│ 7 months                             │
├──────────────────────────────────────┤
│ Octopi Palooza! #11                 │
│ [You: #1] [Them: #3]                │
│ Jan 6, 2026                          │
│                                       │
│ Milkcup #7                           │
│ [You: #20] [Them: #5]               │
│ Dec 15, 2025                         │
│                                       │
│ FLUTI 7                              │
│ [You: #3] [Them: #8]                │
│ Oct 22, 2025                         │
└──────────────────────────────────────┘
```

Much more informative than "Last 3 common tournaments"!

## Future Enhancements

Possible improvements:
- Show total common tournaments if > 3
  - "Showing 3 of 8 common tournaments in the last 12 months"
- Add button to see all common tournaments
- Filter by time range (last 3/6/12 months)
