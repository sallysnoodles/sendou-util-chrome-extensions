# Installation Guide

## Install Locally

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository folder.
6. Open or reload sendou.ink.

There is no build step.

## Icons

The repository includes extension icons under `icons/`. If you replace them, keep these filenames:

- `icons/icon16.png`
- `icons/icon48.png`
- `icons/icon128.png`

## First Run

1. Log in to [sendou.ink](https://sendou.ink/).
2. Visit a page with user links.
3. Look for 📊 and 🔫 icons next to non-navigation user links.
4. Hover 📊 for shared tournaments.
5. Hover 🔫 for weapons.

## Username Settings

The extension tries to auto-detect the logged-in sendou.ink user. If that fails:

1. Click the extension icon in the Chrome toolbar.
2. Enter your sendou.ink username.
3. Click **Save Username**.

Manual username has priority. Use **Clear Manual Username** to return to auto-detection.

## Feature Toggles

The popup can enable or disable:

- Shared tournaments
- Weapons

Changing a setting reloads open sendou.ink tabs.

## Troubleshooting

**Extension not loading**

- Confirm `manifest.json` is valid.
- Reload the extension at `chrome://extensions/`.
- Check the service worker/content script errors in Chrome.

**Icons do not appear**

- Make sure you are on `https://sendou.ink/*`.
- Refresh the page after loading/reloading the extension.
- Header, footer, and nav user links are intentionally skipped.

**Shared tournament popup says to log in**

- Confirm you are logged in to sendou.ink.
- Open the extension popup and set your username manually.

**No shared tournaments**

- The users may not share any tournaments in parsed results.
- Check DevTools Console for `[Match History]` logs and failed requests.
