# Current Behavior Summary

## User Detection

Priority:

1. Manual username saved from the extension popup (`manualUsername`)
2. React Router root loader user data
3. user/session/auth-like localStorage JSON
4. stored auto-detected username (`detectedUsername`)
5. header user link fallback

If the page appears logged out, the extension clears `detectedUsername`.

## Popup Settings

The browser action popup supports:

- Save manual username
- Clear manual username
- Show current user source (`Manual`, `Auto-detected`, or `Not detected`)
- Toggle shared tournaments
- Toggle weapons

Changing settings reloads open sendou.ink tabs.

## User Link Injection

The content script scans `a[href*="/u/"]` and skips links inside:

- `header`
- `footer`
- `nav`

It also skips the logged-in user's own link when known.

## Shared Tournaments

The extension fetches:

```text
https://sendou.ink/u/{username}/results.data?all=true
```

for both the logged-in user and the hovered user.

Shared tournaments are matched by `tournamentId`.

## Teammates

Teammates are detected from parsed `mates` data. Equal placement is not enough.

When teammates are confirmed, the popup renders:

```text
❤️ Teammates: #X
```

Otherwise it renders separate `You` and `Them` placement badges.

## Weapons

Weapon popups fetch the hovered user's profile HTML and parse current sendou.ink weapon image paths:

```text
main-weapons-outlined
/img/main-weapons
```

## Result Page Popup Handling

On `/u/{username}/results`, popups are rendered at `document.body` level to avoid being clipped by result-row/team-list containers.

Only one popup should be active at a time.

## Debugging

Open DevTools Console and look for logs prefixed with:

```text
[Match History]
```
