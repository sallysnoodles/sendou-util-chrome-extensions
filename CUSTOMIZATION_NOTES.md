# Customization Notes for Sendou.ink Extension

## Important: API Integration

This extension is a **template** that needs to be customized for sendou.ink's actual API and HTML structure. Here's what you need to update:

## 1. User Detection (content.js)

### Current Implementation
```javascript
const userLinks = document.querySelectorAll('a[href*="/u/"]');
```

### What to Check
1. Open sendou.ink in Chrome
2. Right-click on a username → Inspect
3. Note the HTML structure around usernames
4. Update the selector if needed

**Possible alternatives:**
- `document.querySelectorAll('[data-user-id]')`
- `document.querySelectorAll('.user-link')`
- Custom selectors based on actual HTML

## 2. Logged-in User Detection (content.js)

### Current Implementation
```javascript
async getLoggedInUser() {
  const userNavElement = document.querySelector('[data-testid="user-nav"]') ||
                         document.querySelector('nav a[href*="/u/"]');
  // ...
}
```

### How to Find the Correct Selector
1. Log in to sendou.ink
2. Open DevTools (F12)
3. Inspect the navigation area where your username appears
4. Note the HTML structure
5. Update the selectors in `getLoggedInUser()`

**Check these locations:**
- Navigation bar
- User dropdown menu
- Profile icon/avatar
- localStorage/sessionStorage (check in DevTools → Application)

## 3. API Endpoints (content.js)

### Current Placeholder
```javascript
const response = await fetch(
  `https://sendou.ink/api/matches?user1=${this.loggedInUser}&user2=${username}&limit=3`
);
```

### How to Find Real API Endpoints

1. **Open sendou.ink and DevTools**
   - Press F12
   - Go to the Network tab
   - Filter by "Fetch/XHR"

2. **Navigate to a user profile or match history**
   - Watch for API calls in the Network tab
   - Look for endpoints containing:
     - "match"
     - "tournament"
     - "user"
     - "history"

3. **Inspect the API Response**
   - Click on the API call
   - Check the "Preview" or "Response" tab
   - Note the data structure

4. **Update the code**
   - Replace the fetch URL
   - Update the response parsing in `renderMatches()`

### Example Real API Patterns

**GraphQL (if sendou.ink uses GraphQL):**
```javascript
const response = await fetch('https://sendou.ink/api/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      query MatchHistory($user1: String!, $user2: String!) {
        matches(user1: $user1, user2: $user2, limit: 3) {
          id
          tournament { name, url }
          date
        }
      }
    `,
    variables: { user1: this.loggedInUser, user2: username }
  })
});
```

**REST API:**
```javascript
const response = await fetch(
  `https://sendou.ink/api/v2/users/${this.loggedInUser}/matches/${username}?limit=3`
);
```

## 4. Data Structure Mapping

### Update `renderMatches()` based on actual API response

**If API returns:**
```json
{
  "data": [
    {
      "id": "123",
      "tournament": {
        "name": "Tournament Name",
        "slug": "tournament-slug"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Update the mapping:**
```javascript
renderMatches(matches, contentElement) {
  const html = `
    <div class="match-history-list">
      <div class="match-history-header">Last ${matches.length} match${matches.length > 1 ? 'es' : ''}</div>
      ${matches.map(match => `
        <div class="match-history-item">
          <a href="/tournament/${match.tournament.slug}" target="_blank" class="match-history-link">
            <div class="match-tournament-name">${this.escapeHtml(match.tournament.name)}</div>
            <div class="match-date">${this.formatDate(match.createdAt)}</div>
          </a>
        </div>
      `).join('')}
    </div>
  `;
  contentElement.innerHTML = html;
}
```

## 5. Testing Checklist

- [ ] Can detect logged-in user correctly
- [ ] Shows button next to all usernames
- [ ] Button toggles the content block
- [ ] API calls return valid data
- [ ] Match links navigate to correct pages
- [ ] Works on different sendou.ink pages (profiles, tournaments, etc.)
- [ ] Handles errors gracefully (no matches, API errors, not logged in)
- [ ] Dark mode works correctly

## 6. Debugging

### Enable console logging
Add to `content.js`:
```javascript
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log('[Match History]', ...args);
}
```

### Check for errors
1. Open DevTools Console (F12)
2. Look for red error messages
3. Check Network tab for failed requests
4. Verify API responses

### Common Issues

**No buttons appearing:**
- Check if user selector is correct
- Verify the page has loaded completely
- Check console for JavaScript errors

**API calls failing:**
- Verify the API endpoint URL
- Check if authentication is required
- Look at CORS errors (may need background.js)
- Verify request/response format

**Wrong match data:**
- Check data structure mapping
- Verify username extraction
- Check tournament URL format

## 7. Optional Enhancements

### Add Authentication Headers
If sendou.ink API requires authentication:
```javascript
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Add Caching
```javascript
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

async fetchMatches(username) {
  const cacheKey = `${this.loggedInUser}-${username}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
    return cached.data;
  }

  const data = await this.fetchMatchesFromAPI(username);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

### Add Loading States
Already implemented with the loading spinner!

## Need Help?

1. Check sendou.ink's GitHub if it's open source
2. Look for API documentation
3. Join sendou.ink's Discord/community
4. Inspect network requests to reverse-engineer the API
