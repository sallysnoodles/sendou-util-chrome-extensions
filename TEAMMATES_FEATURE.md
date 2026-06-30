# Teammates Detection Feature

The extension detects when you and another player were teammates in a shared tournament and displays that relationship with a single teammate badge.

## How It Detects Teammates

Teammates are detected from the tournament result `mates` data parsed from `https://sendou.ink/u/{username}/results.data?all=true`.

The extension does **not** treat equal placement as proof of being teammates. Equal placements can happen when different teams tie or when data is grouped by division.

### Current Logic

```javascript
const otherUsernameLower = otherUsername.toLowerCase();
const wereTeammates =
  tournament1.teammates.length > 0 &&
  tournament1.teammates.some(mate => mate.toLowerCase() === otherUsernameLower);
```

`tournament1` is the logged-in user's parsed tournament result. If the hovered user's username appears in that result's `mates` array, the users were teammates.

## Display

### Teammates

```text
❤️ Teammates: #1 (Division A)
```

When users were teammates, the extension renders one teammate badge instead of separate "You" and "Them" placement badges.

### Not Teammates

```text
You: #3    Them: #3
```

Even if both users have the same placement, the extension keeps separate badges unless the `mates` array confirms they were on the same team.

## Parsing

`parseResults()` walks the Remix-style encoded response and extracts:

- `tournamentId`
- `eventName`
- `startTime`
- `placement`
- `division`
- `teamCount`
- `teammates`

For teammate parsing, it looks for array values on each tournament object, resolves referenced mate objects, and collects username-like strings as lowercase teammate names.

## Edge Cases

- Missing or empty `mates` data means `wereTeammates = false`.
- Same placement but not in `mates` means users are shown separately.
- Division text is shown from `yourDivision` first, then `theirDivision`.
- The teammate check is case-insensitive.

## Files

- `content.js`
  - `parseResults()`: extracts `teammates`
  - `findCommonTournaments()`: computes `wereTeammates`
  - `renderMatches()`: renders teammate or separate placement badges
- `styles.css`
  - `.placement-teammates`: teammate badge styling

## Key Point

Same placement does not mean teammates. The source of truth is the parsed `mates` array.
