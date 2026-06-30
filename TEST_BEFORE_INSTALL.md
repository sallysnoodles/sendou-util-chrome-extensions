# Test Before Installing

You can sanity-check the sendou.ink endpoints from a sendou.ink page before loading the extension.

## 1. Open Sendou

Go to [https://sendou.ink](https://sendou.ink) and log in.

## 2. Open DevTools

Press **F12** or **Cmd+Option+I**, then open the Console tab.

## 3. Test Results Data

Replace `yourUsername` with a real sendou.ink username:

```javascript
const username = "yourUsername";
const data = await fetch(`/u/${username}/results.data?all=true`).then(r => r.json());
console.log(Array.isArray(data), data.length, data.slice(0, 10));
```

Expected:

- `Array.isArray(data)` is `true`
- The array has items for users with tournament history

## 4. Test Profile HTML for Weapons

```javascript
const username = "yourUsername";
const html = await fetch(`/u/${username}`).then(r => r.text());
const doc = new DOMParser().parseFromString(html, "text/html");
const weapons = [...doc.querySelectorAll(
  'img[src*="main-weapons-outlined"], img[data-testid][src*="/img/main-weapons"]'
)].map(img => ({
  name: img.alt || img.title || img.closest("[title]")?.title,
  src: img.src
}));
console.table(weapons);
```

Expected:

- Users with weapons listed on their profile show rows in the table.
- Users without profile weapons may show an empty table.

## 5. Install and Test the Extension

After endpoint checks pass:

1. Follow `QUICK_START.md`.
2. Reload sendou.ink.
3. Hover 📊 beside a user.
4. Hover 🔫 beside a user.
5. Check Console logs for `[Match History]`.

## Troubleshooting

**Results request fails**

- Confirm you are on sendou.ink.
- Confirm the username exists.
- Try a known user with public tournament history.

**Results array is empty**

- The user may not have tournament results.
- sendou.ink may have changed the data route or response shape.

**Weapons table is empty**

- The user may not list weapons.
- sendou.ink may have changed profile weapon markup or asset paths.

**Extension still fails after manual checks pass**

- Check `TROUBLESHOOTING.md`.
- Verify username detection in the extension popup.
- Look for `[Match History]` console errors.
