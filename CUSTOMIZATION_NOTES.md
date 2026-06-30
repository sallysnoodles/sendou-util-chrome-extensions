# Maintenance Notes

This extension is no longer a placeholder template. It uses current sendou.ink page/data shapes directly, but several parts are intentionally heuristic because sendou.ink does not expose a simple comparison endpoint for this use case.

## User Link Detection

User popups are injected for links matching:

```javascript
a[href*="/u/"]
```

Links inside `header`, `footer`, or `nav` are skipped by `isInHeaderFooterOrNav()` so navigation/profile-tab links are not decorated.

## Logged-In User Detection

Priority order:

1. `chrome.storage.local.manualUsername`
2. React Router root loader user data
3. session/auth/user-like localStorage JSON
4. clear logged-out state, which removes `detectedUsername`
5. stored `chrome.storage.local.detectedUsername`
6. header user link fallback

Manual username can be set or cleared from the extension popup.

## Shared Tournament Data

Current endpoint:

```text
https://sendou.ink/u/{username}/results.data?all=true
```

`fetchMatches(username)` fetches results for the logged-in user and the hovered user, then compares parsed tournament IDs.

`parseResults(data)` walks Remix-style encoded arrays and extracts tournament fields with heuristics:

- tournament ID
- event name
- start time
- placement
- division
- teammates from `mates`
- team count

If sendou.ink changes the encoded response shape, update `parseResults()` first.

## Teammate Detection

Do not use equal placement as teammate proof.

Current teammate logic:

```javascript
const wereTeammates = tournament1.teammates.some(
  mate => mate.toLowerCase() === otherUsernameLower
);
```

`tournament1` is the logged-in user's tournament result. If the hovered user's username is in that result's parsed `mates` list, the extension renders the teammate badge.

## Weapon Parsing

Weapon popups fetch the target profile page:

```text
https://sendou.ink/u/{username}
```

Current selectors:

```javascript
img[src*="main-weapons-outlined"]
img[data-testid][src*="/img/main-weapons"]
```

Update `extractWeaponsFromProfile()` if sendou.ink changes profile markup or weapon asset paths.

## Popup Behavior

Normal pages use inline absolute-positioned popups inside `.match-history-container`.

Individual result pages (`/u/{username}/results`) use a body-level fixed popup class so result-row/team-list containers do not clip the popup.

Only one popup should be active at a time.

## Testing Checklist

- `node --check content.js`
- `node --check popup.js`
- Load unpacked extension in Chrome.
- Reload sendou.ink.
- Test 📊 and 🔫 on:
  - User profile
  - Individual user results page
  - Tournament/team/user-list pages
- Test manual username save and clear from the extension popup.

## Common Maintenance Risks

- Remix encoded response format changes.
- sendou.ink profile weapon image paths change.
- Header/nav markup changes and starts looking like content user links.
- User custom URLs differ from usernames in ways not covered by current normalization.
