# Troubleshooting Guide

Open DevTools Console on sendou.ink and look for logs prefixed with:

```text
[Match History]
```

## User Detection

Manual username wins over auto-detection.

Storage keys:

- `manualUsername`: set from the extension popup
- `detectedUsername`: saved after successful auto-detection
- `showTournaments`: tournament popup toggle
- `showWeapons`: weapon popup toggle

Check storage from the extension popup context or an extension-aware console:

```javascript
chrome.storage.local.get(
  ["manualUsername", "detectedUsername", "showTournaments", "showWeapons"],
  console.log
);
```

Clear manual username:

```javascript
chrome.storage.local.remove(["manualUsername"]);
```

## "Please log in"

Likely causes:

- You are not logged in to sendou.ink.
- Auto-detection failed.
- `detectedUsername` was cleared because the page looked logged out.

Fixes:

1. Log in to sendou.ink and reload.
2. Open the extension popup.
3. Set your username manually.

## Wrong User Detected

The current detector avoids generic nav/profile-tab links because they can point to the profile owner instead of the logged-in viewer.

Manual override is the safest fix:

1. Open the extension popup.
2. Save the correct sendou.ink username.
3. Reload sendou.ink.

## No Icons Appear

Expected skips:

- Header links
- Footer links
- Navigation links
- Your own username

Other checks:

- Confirm the extension is enabled.
- Reload the sendou.ink tab.
- Verify the page contains links matching `/u/{username}`.

## Shared Tournament Popup Fails

The extension fetches both users' tournament result data:

```text
https://sendou.ink/u/{username}/results.data?all=true
```

Manual test from a sendou.ink page:

```javascript
await fetch("/u/yourUsername/results.data?all=true").then(r => r.json());
```

Common causes:

- Username is incorrect.
- User has no results.
- sendou.ink changed the Remix encoded response shape.
- The parser found no tournament-like `value` arrays.

## "No Shared Tourneys"

This can be correct. The extension compares parsed tournament IDs from both users and only shows tournaments found in both histories.

It does not show individual match history or head-to-head wins/losses.

## Teammates Look Wrong

The extension does not infer teammates from equal placement.

It marks teammates only when the hovered username is found in the logged-in user's parsed `mates` array for that tournament. Missing `mates` data falls back to separate "You" and "Them" badges.

## Weapon Popup Fails

Weapon popups fetch the target profile:

```text
https://sendou.ink/u/{username}
```

The parser currently looks for weapon images matching:

```text
img[src*="main-weapons-outlined"]
img[data-testid][src*="/img/main-weapons"]
```

If sendou.ink changes profile markup or weapon asset paths, this parser may need updating.

## Result Page Popup Placement

On `/u/{username}/results`, popups are moved to `document.body` so they are not clipped by teammate/result row containers.

Only one popup should be active at a time. Hovering another 📊 or 🔫 closes the previous popup.

## Debug Checklist

When reporting an issue, include:

1. Page URL.
2. Console logs containing `[Match History]`.
3. Whether `manualUsername` is set.
4. The hovered username.
5. Whether the issue is with 📊 tournaments or 🔫 weapons.
