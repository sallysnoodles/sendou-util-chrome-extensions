# Teammates Detection Fix

## Problem

The original implementation incorrectly assumed that **same placement = teammates**. This is wrong because:
- Multiple teams can tie for the same placement
- Players with same placement might have competed against each other

## Correct Solution

Check the **`mates` field** in the API response, which contains the actual list of teammates.

## How It Works Now

### 1. Parse Teammates from API

The parser now extracts the `mates` array from each tournament:

```javascript
tournament = {
  tournamentId: 3268,
  eventName: "Octopi Palooza! #11",
  placement: 1,
  teammates: ["david", "beaner", "othermember"]  // ← Extracted from mates array
}
```

### 2. Check Against Mates List

When comparing tournaments, check if the other user's username is in your teammates list:

```javascript
const wereTeammates = tournament1.teammates.includes(otherUsername.toLowerCase());
```

### 3. Display Accordingly

**If in mates list:**
```
❤️ Teammates #1 (Division A)
```

**If not in mates list (opponents or different teams):**
```
[You: #1] [Them: #1]
```
Same placement but different teams (tie scenario).

## API Structure

From the API response you shared:

```javascript
"mates",[62],
{
  "_7":63,      // References to mate data
  "_9":64,      // username
  "_11":65,     // discordId
  "_13":66,     // discordAvatar
  "_15":67,     // customUrl
}
38730,          // User ID
"David",        // Username ← This is what we extract
"722916771107045487",  // Discord ID
...
```

## Parser Logic

### Extraction Process

1. **Find arrays** in tournament object
2. **Check if it's mates array** by looking at structure
3. **Extract usernames** from mate objects
4. **Store as lowercase** for case-insensitive comparison

```javascript
// During parsing
for (const mateRef of matesArray) {
  const mateObj = resolve(mateRef);
  // Extract username strings (3-30 chars, no special chars)
  if (isUsername(mateValue)) {
    tournament.teammates.push(mateValue.toLowerCase());
  }
}
```

### Teammate Detection

```javascript
// During comparison
const otherUsernameLower = otherUsername.toLowerCase();
const wereTeammates = tournament.teammates.includes(otherUsernameLower);
```

## Examples

### Example 1: Actual Teammates
```
API data shows:
- Your tournament: placement #1, mates: ["david", "felix", "marq"]
- Their username: "david"
- Result: wereTeammates = true

Display:
❤️ Teammates #1
```

### Example 2: Tied Placements (Not Teammates)
```
API data shows:
- Your tournament: placement #3, mates: ["bob", "alice"]
- Their username: "charlie"
- Both got #3 (tie scenario)
- Result: wereTeammates = false

Display:
[You: #3] [Them: #3]
```

### Example 3: Different Placements (Opponents)
```
API data shows:
- Your tournament: placement #1, mates: ["bob"]
- Their username: "charlie"
- They got #2
- Result: wereTeammates = false

Display:
[You: #1] [Them: #2]
```

## Edge Cases Handled

### No Mates Data
If mates array is empty or missing:
```javascript
wereTeammates = false  // Default to showing separate badges
```

### Case Sensitivity
All comparisons are lowercase:
```javascript
teammates: ["David", "FELIX"]  → ["david", "felix"]
otherUsername: "David"         → "david"
Match! ✓
```

### Username Variations
The parser extracts multiple username-like strings from mate objects, increasing chance of match:
- Actual username
- Custom URL
- Display name
- etc.

## Console Logs

### Teammates Detected
```
[Match History] ✓ Shared tourney found: 3268 - Octopi Palooza! #11 (Teammates #1)
```

### Opponents
```
[Match History] ✓ Shared tourney found: 3195 - FLUTI 7 (You: #3, Them: #8)
```

## Benefits of Correct Implementation

### 1. Accurate Detection
- No false positives from tied placements
- Only shows teammates when actually on same team

### 2. Handles Ties Correctly
- Two teams can both get #3 (tie)
- Shows separate badges since they're not teammates

### 3. Robust Username Matching
- Case-insensitive comparison
- Extracts multiple username variants from API

### 4. Clear Logs
- Debug logs show why teammates was detected
- Or shows separate placements if not teammates

## Testing

### Test Case 1: Verify Teammates
- Find tournament where you know you were teammates
- Should show: `❤️ Teammates #X`
- Check console: "Teammates #X" in log

### Test Case 2: Verify Tied Opponents
- Find tournament with tied placements but different teams
- Should show: `[You: #3] [Them: #3]`
- Check console: "(You: #3, Them: #3)" in log

### Test Case 3: Normal Opponents
- Tournament with different placements
- Should show: `[You: #1] [Them: #5]`

## Files Changed

1. **content.js**
   - `parseResults()`: Extract teammates array from mates data
   - `findCommonTournaments()`: Check username against teammates array
   - Return object: Include wereTeammates boolean flag
   - `renderMatches()`: Use wereTeammates flag (not placement comparison)

## Technical Details

### Parser Changes

**Added to tournament object:**
```javascript
teammates: []  // Array of lowercase usernames
```

**Array detection:**
```javascript
else if (Array.isArray(value)) {
  // Check if this is mates array
  const possibleMates = extractUsernamesFromMatesArray(value);
  if (possibleMates.length > 0) {
    tournament.teammates = possibleMates;
  }
}
```

### Comparison Changes

**Function signature:**
```javascript
findCommonTournaments(results1, results2, otherUsername) {
  // Now takes otherUsername parameter
}
```

**Detection logic:**
```javascript
const wereTeammates = tournament1.teammates.some(
  mate => mate.toLowerCase() === otherUsername.toLowerCase()
);
```

### Display Changes

**Uses flag instead of comparison:**
```javascript
// Old (wrong):
const wereTeammates = match.yourPlacement === match.theirPlacement;

// New (correct):
const wereTeammates = match.wereTeammates;
```

## Summary

The extension now **correctly detects teammates** by checking the actual `mates` field from the API response, not by comparing placement numbers. This handles tie scenarios properly and only shows the teammates badge when users were genuinely on the same team.

**Key insight:** Same placement ≠ teammates. Must check mates array!
