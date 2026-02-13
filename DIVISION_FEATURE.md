# Division Feature Added

## What Changed

The extension now detects and displays **tournament divisions** when they exist in the tournament data.

## What are Divisions?

Some tournaments have multiple divisions/brackets like:
- **Division A** (typically top/pro tier)
- **Division B, C, D** (other skill levels)

Not all tournaments have divisions - this field is **optional**.

## How It Works

### 1. Parser Updated
The parser now captures the division field:

```javascript
tournament = {
  tournamentId: 3195,
  eventName: "FLUTI 7",
  placement: 3,
  division: "Division A"  // ← NEW!
}
```

### 2. Both Players' Divisions Captured
When finding shared tourneys, both divisions are stored:

```javascript
{
  yourPlacement: 3,
  theirPlacement: 8,
  yourDivision: "Division A",    // ← NEW!
  theirDivision: "Division B"    // ← NEW!
}
```

### 3. Display Format

**When division exists:**
```
Tournament Name
[You: #3 (Division A)] [Them: #8 (Division B)]
Date
```

**When no division:**
```
Tournament Name
[You: #3] [Them: #8]
Date
```

**When only you have division:**
```
Tournament Name
[You: #3 (Division A)] [Them: #8]
Date
```

## Examples

### Example 1: FLUTI 7 (Has Divisions)
```
FLUTI 7
[You: #3 (Division A)] [Them: #8 (Division A)]
Jan 8, 2026
```

### Example 2: Swim or Sink 210 (No Divisions)
```
Swim or Sink 210
[You: #29] [Them: #15]
Dec 6, 2025
```

### Example 3: Different Divisions
```
Tournament Name
[You: #5 (Division A)] [Them: #2 (Division B)]
Date
```
This shows you competed in different divisions of the same tournament!

## Detection Logic

The parser identifies divisions by looking for strings that:
- ✅ Start with "Division"
- ✅ Are less than 20 characters
- ✅ Don't contain URLs or paths

Common patterns detected:
- "Division A"
- "Division B"
- "Division C"
- etc.

## Benefits

### 1. Context About Competition Level
Shows which bracket each player competed in - important for understanding placement context.

### 2. Different Division Detection
If you and another player have different divisions (e.g., Division A vs Division B), you'll see it clearly.

### 3. Optional Display
If a tournament doesn't have divisions, nothing changes - badges look the same as before.

### 4. Complete Information
Provides full context about tournament results without cluttering the UI when not needed.

## Console Logs

With debug mode, division info appears in logs:

```
[Match History] ✓ Shared tourney found: 3195 - FLUTI 7 (You: #3, Them: #8)
```

## Technical Details

### Parser Changes

**Added to tournament object:**
```javascript
division: null
```

**Detection in parsing loop:**
```javascript
if (value.startsWith('Division') && value.length < 20 && !tournament.division) {
  tournament.division = value;
}
```

**Priority order for strings:**
1. Division names (checked first)
2. Event names
3. Logo URLs

### Data Flow

1. **Parse** → Extract division from API response
2. **Store** → Save both players' divisions in common tournament object
3. **Render** → Display division in badges when present

### Badge Text Generation

```javascript
`You: #${placement}${division ? ` (${division})` : ''}`
```

- If division exists: `You: #3 (Division A)`
- If no division: `You: #3`

## Edge Cases Handled

### Both Have Division
```
[You: #3 (Division A)] [Them: #8 (Division A)]
```

### Only One Has Division
```
[You: #3 (Division A)] [Them: #8]
```
(Rare, but handled gracefully)

### Neither Has Division
```
[You: #3] [Them: #8]
```
(Most tournaments - no change from before)

### Different Divisions
```
[You: #1 (Division B)] [Them: #1 (Division A)]
```
Both got 1st place, but in different divisions!

## Visual Impact

### Short Divisions ("Division A")
Badges remain compact and readable.

### Longer Divisions
If divisions have longer names, badges might wrap on narrow screens (handled by flexbox).

## Files Changed

1. **content.js**
   - `parseResults()`: Added division detection
   - `findCommonTournaments()`: Store both divisions
   - Return object: Include yourDivision, theirDivision
   - `renderMatches()`: Display division in badges

## Testing

After applying this update, test with:

1. **Tournament with divisions** (e.g., FLUTI 7)
   - Should show "(Division A)" in badges

2. **Tournament without divisions** (e.g., Swim or Sink 210)
   - Should show normal badges without division

3. **Different divisions**
   - Find a tournament where players competed in different brackets
   - Should show both divisions clearly

## Console Check

Look for division info in parsed data:
```
[Match History] Parsed 25 tournaments for username
```

Then check if divisions are detected:
```
[Match History] ✓ Shared tourney found: 3195 - FLUTI 7 (You: #3, Them: #8)
```

## Future Enhancements

Possible additions:
- Division-specific filtering
- Show only Division A results
- Highlight when players competed in same division
- Division comparison stats

## Summary

The extension now provides **complete tournament context** by showing which division/bracket each player competed in, when that information exists. This is displayed inline with the placement badges, keeping the UI clean while providing valuable context for competitive analysis.

Format: `You: #3 (Division A)` when division exists, `You: #3` when it doesn't.
