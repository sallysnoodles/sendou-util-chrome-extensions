# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) called "Sendou Utils" for sendou.ink — a Splatoon competitive platform. It adds hover-activated popups next to user links showing shared tournament history and weapon profiles.

## Architecture

**No build system** — plain vanilla JS loaded directly by Chrome. To test changes, load unpacked at `chrome://extensions/` and reload the extension + sendou.ink page.

### Key Files

- **content.js** — `MatchHistoryExtension` class injected into sendou.ink pages. Core logic:
  - Detects logged-in user via DOM selectors, localStorage, or manual override from `chrome.storage.local`
  - Uses `MutationObserver` to detect dynamically-added user links (`a[href*="/u/"]`)
  - Wraps each user link in a `.match-history-wrapper` with hover-triggered popup buttons
  - **Shared tournaments (📊)**: Fetches both users' results from `/u/{username}/results.data?all=true`, parses Remix-style encoded response (numeric references into a flat data array), finds common tournament IDs
  - **Weapons (🔫)**: Fetches target user's profile HTML, parses `.u__weapon` elements via DOMParser
- **popup.html / popup.js** — Extension popup for manual username override and feature toggles (tournaments, weapons) stored in `chrome.storage.local`
- **background.js** — Minimal service worker (install/update logging only)
- **styles.css** — Popup tooltip styling with dark mode support via `prefers-color-scheme`

### Data Flow

1. `fetchUserResults(username)` → GET `https://sendou.ink/u/{username}/results.data?all=true` → JSON array
2. `parseResults(data)` → Walks the Remix-encoded flat array looking for `"value"` keys followed by arrays of tournament objects. Resolves numeric references back into the data array. Extracts tournamentId, eventName, startTime, placement, division, teammates, teamCount.
3. `findCommonTournaments()` → Matches by tournamentId across both users, detects teammate status from mates array

### Important Patterns

- The Remix API response parser (`parseResults`) uses heuristics to identify field types (e.g., 4-digit numbers = tournament IDs, large numbers = timestamps). This is fragile and may break if sendou.ink changes their response format.
- User links in header/footer/nav are intentionally excluded from processing via `isInHeaderFooterOrNav()`.
- Settings changes in popup trigger automatic reload of all sendou.ink tabs.
