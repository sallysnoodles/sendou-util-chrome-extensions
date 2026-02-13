# Teammates Detection Feature

## What Changed

The extension now detects when you and another player were **teammates** in a tournament and displays it differently.

## How It Detects Teammates

When both players have the **same placement number**, they were on the same team.

### Logic:
```
If yourPlacement === theirPlacement:
  → You were teammates!
```

## Display Changes

### Before (Same Placement):
```
[You: #1 (Division A)] [Them: #1 (Division A)]
```
Redundant - same info twice!

### After (Teammates):
```
❤️ Teammates #1 (Division A)
```
Cleaner and more meaningful!

## Examples

### Example 1: Teammates Win
```
Tournament Name
❤️ Teammates #1
Jan 15, 2026
```
You both got 1st place → You were on the same team!

### Example 2: Teammates with Division
```
Tournament Name
❤️ Teammates #3 (Division A)
Jan 15, 2026
```

### Example 3: Opponents (Different Placements)
```
Tournament Name
[You: #1] [Them: #3]
Jan 15, 2026
```
Different placements → You competed against each other

### Example 4: Opponents in Different Divisions
```
Tournament Name
[You: #2 (Division A)] [Them: #1 (Division B)]
Jan 15, 2026
```

## Badge Colors

**Teammates badge:**
- Pink to orange gradient (`#ec4899` → `#f97316`)
- Warm, friendly colors representing teamwork
- Distinct from "You" (purple) and "Them" (blue)

**Visual hierarchy:**
- ❤️ Teammates = Pink/Orange gradient
- You = Purple gradient
- Them = Blue solid

## When Teammates Badge Shows

✅ **Shows when:**
1. Both placements exist
2. Both placements are the same number
3. You competed in the same tournament

❌ **Doesn't show when:**
1. Placements are different (you were opponents)
2. One placement is missing
3. Placements are null/undefined

## Division Handling

**Same division:**
```
❤️ Teammates #1 (Division A)
```

**Different divisions (rare edge case):**
Uses the first available division:
```
❤️ Teammates #1 (Division A)
```

**No division:**
```
❤️ Teammates #1
```

## Benefits

### 1. Clearer Information
- Immediately shows teammate relationship
- No redundant information

### 2. Better UX
- Heart emoji adds emotional connection
- Distinct color shows different relationship type

### 3. Accurate Context
- Same placement = teammates (not coincidence)
- Different placement = opponents

### 4. Cleaner UI
- One badge instead of two identical badges
- Less visual clutter

## Real-World Scenarios

### Scenario 1: Tournament Partners
You and a friend teamed up for a tournament and got 2nd place:
```
❤️ Teammates #2
```

### Scenario 2: Competitive Rivals
You faced each other in finals:
```
[You: #1] [Them: #2]
```

### Scenario 3: Division Champions
You both won your respective divisions:
```
[You: #1 (Division A)] [Them: #1 (Division B)]
```
Same placement number but different divisions = not teammates!

## Technical Implementation

### Detection Logic
```javascript
const wereTeammates = match.yourPlacement && match.theirPlacement &&
                      match.yourPlacement === match.theirPlacement;
```

### Rendering Logic
```javascript
if (wereTeammates) {
  // Single teammates badge
  const division = match.yourDivision || match.theirDivision;
  return `❤️ Teammates #${placement}${division ? ` (${division})` : ''}`;
} else {
  // Separate You/Them badges
  return `[You: ...] [Them: ...]`;
}
```

### Division Priority
When teammates, uses first available division:
1. Try `yourDivision`
2. Fallback to `theirDivision`
3. If neither, don't show division

(Usually both have same division when teammates)

## Edge Cases Handled

### Both Same Placement, No Division
```
❤️ Teammates #5
```

### Both Same Placement, Both Have Division
```
❤️ Teammates #3 (Division A)
```

### Same Placement, Only One Has Division
```
❤️ Teammates #2 (Division A)
```
Uses available division.

### Different Placements
```
[You: #1] [Them: #3]
```
Normal opponent display.

### Missing Placements
If either placement is missing, doesn't show teammates badge (falls back to normal display).

## Console Logs

No special logging for teammates detection - it's a display-only feature.

The underlying data remains the same:
```javascript
{
  yourPlacement: 1,
  theirPlacement: 1,
  yourDivision: "Division A",
  theirDivision: "Division A"
}
```

The rendering just decides how to display it.

## CSS Styling

```css
.placement-teammates {
  background: linear-gradient(135deg, #ec4899 0%, #f97316 100%);
}
```

Pink to orange gradient for warmth and friendliness.

## Testing

### Test Case 1: Teammates
- Find tournament where you have same placement as another user
- Should show: `❤️ Teammates #X`

### Test Case 2: Opponents
- Find tournament where you have different placement
- Should show: `[You: #X] [Them: #Y]`

### Test Case 3: Teammates with Division
- Find tournament with same placement and divisions
- Should show: `❤️ Teammates #X (Division A)`

## Files Changed

1. **content.js**
   - `renderMatches()`: Added teammates detection logic
   - Conditional rendering based on placement equality

2. **styles.css**
   - Added `.placement-teammates` class
   - Pink/orange gradient styling

## User Experience Impact

### Positive Changes:
✅ Clearer relationship context
✅ Less redundant information
✅ Emotional connection with heart emoji
✅ Distinct visual style for teammates

### No Breaking Changes:
✅ Opponent display unchanged
✅ No data structure changes
✅ Backwards compatible

## Summary

When you and another player have the **same placement** in a tournament, you were **teammates** on the same team. Instead of showing two identical badges, the extension now shows:

```
❤️ Teammates #1 (Division A)
```

This makes the relationship clearer, reduces redundancy, and adds a friendly touch with the heart emoji and warm gradient colors.

Different placements still show separate badges as before:
```
[You: #1] [Them: #3]
```

This gives you instant context about whether you teamed up or competed against each other in past tournaments!
