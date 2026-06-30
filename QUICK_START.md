# Quick Start

## 1. Load the Extension

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

## 2. Open Sendou

1. Go to [https://sendou.ink](https://sendou.ink).
2. Log in.
3. Reload the page after loading the extension.

## 3. Use the Popups

- Hover 📊 next to a user to load shared tournaments.
- Hover 🔫 next to a user to load weapons from their profile.
- Header/footer/nav links are intentionally ignored.

## 4. Set Username Manually If Needed

If the extension cannot detect your logged-in user:

1. Click the extension icon in Chrome.
2. Enter your sendou.ink username.
3. Click **Save Username**.

Manual username takes priority over auto-detection. Click **Clear Manual Username** to return to auto-detection.

## 5. Verify Requests

Open DevTools Console and look for `[Match History]` logs.

Shared tournaments use:

```text
https://sendou.ink/u/{username}/results.data?all=true
```

Weapon popups fetch:

```text
https://sendou.ink/u/{username}
```

## Common Problems

**No icons**

- Confirm the extension is enabled.
- Reload sendou.ink.
- Check that the user link is not in header/footer/nav.

**Please log in**

- Confirm you are logged in.
- Set a manual username in the extension popup.

**No shared tournaments**

- The users may not share tournaments.
- Check Console logs for parsed tournament counts.

**Weapons missing**

- The profile may not list weapons.
- sendou.ink may have changed the weapon image markup or asset path.
