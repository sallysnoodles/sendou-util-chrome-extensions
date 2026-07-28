# Sendou Utils

Chrome extension for [sendou.ink](https://sendou.ink/) that adds hover popups next to user links and native user-card triggers.

## Features

- 📊 Shared tournament popup between you and another user
- ⚔️ Recent SendouQ and tournament sets where you played on opposing teams
- 🔫 Weapon popup from the hovered user's profile
- ❤️ Teammate badge when the parsed `mates` data confirms you were on the same team
- 🏆 Tournament names, dates, placements, divisions, team counts, and links
- 🧭 LUTI S17 division banner when local LUTI data has a match
- ↕️ Viewport-aware popups that open above or below and scroll when needed
- 🌗 Light/dark popup styling via `prefers-color-scheme`
- ⚙️ Popup settings for manual username override and feature toggles

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.
6. Reload any open sendou.ink tabs after changing code or popup settings.

There is no build step. The extension is plain Manifest V3 JavaScript loaded directly by Chrome.

## Usage

1. Log in to sendou.ink.
2. Navigate to pages with user links.
3. Hover 📊 next to a user to see shared tournaments.
4. Hover 🔫 next to a user to see weapons listed on their profile.
5. Use the extension popup to:
   - Manually set your username when auto-detection fails
   - Clear a manual username and return to auto-detection
   - Toggle tournament and weapon popups

## How It Works

### User Detection

Manual username from `chrome.storage.local.manualUsername` has highest priority.

If no manual username is set, the content script tries to detect the logged-in viewer from sendou.ink's React Router root loader data, localStorage/session-like data, a header fallback, and the saved `detectedUsername` value.

Header/footer/nav user links are excluded from popup injection to avoid decorating site navigation.

### Shared Tournaments

`fetchUserResults(username)` requests paginated result data:

```text
https://sendou.ink/u/{username}/results.data?all=true&page={page}
```

Pages are fetched until the extension crosses the six-month cutoff or reaches the final page. Parsed per-user results are cached in `chrome.storage.local` for 12 hours. `parseResults(data)` decodes the Remix-style flat array and extracts tournament records. `findCommonTournaments()` matches both users by `tournamentId`, sorts newest first, and identifies teammates by exact tournament team ID with parsed `mates` as a compatibility fallback.

The popup also scans the viewer's recent SendouQ season history and shared tournament brackets. An encounter is included only when the two user IDs appear on opposite SendouQ sides or their distinct tournament team IDs appear in the same completed bracket match. Teammate sets are excluded.

### Weapons

`loadWeapons(username)` fetches the user's profile HTML and `extractWeaponsFromProfile()` parses weapon images matching current sendou.ink weapon asset paths, including:

```text
img[src*="main-weapons-outlined"]
img[data-testid][src*="/img/main-weapons"]
```

Relative image URLs are converted to absolute sendou.ink URLs.

## File Structure

```text
manifest.json          Extension configuration
content.js             Main content script
background.js          Minimal service worker
styles.css             Popup and badge styling
popup.html             Browser action popup
popup.js               Popup settings logic
data/                  Local LUTI lookup data
icons/                 Extension icons
```

## Permissions

- `storage`: saves settings, detected usernames, and the 12-hour tournament-results cache
- `https://sendou.ink/*`: reads sendou pages and profile/results data

## Development

1. Edit files directly.
2. Go to `chrome://extensions/`.
3. Click the reload icon on the extension.
4. Reload sendou.ink.
5. Check DevTools Console for `[Match History]` logs.

Useful checks:

```bash
node --check content.js
node --check popup.js
```

## Known Limitations

- The parser depends on sendou.ink's current Remix response shape and can break if that changes.
- Recent SendouQ history requires an active sendou.ink login and is capped to the two most recent participated seasons and their newest history pages.
- Weapon scraping depends on profile HTML and weapon image paths.
