# API Discovery Guide for Sendou.ink

Based on the workflow: User Page → Results Tab → Tournament History

## Step-by-Step: Finding the API Endpoint

### 1. Prepare DevTools

1. Open sendou.ink and log in
2. Press **F12** to open DevTools
3. Go to the **Network** tab
4. Check **"Preserve log"** (checkbox at the top)
5. Click the **"Fetch/XHR"** filter button
6. Clear the network log (🚫 icon)

### 2. Navigate to Results

1. **Click on any user** (goes to `/u/username`)
2. **Click on the "Results" tab**
3. Watch the Network tab - you should see API requests appear

### 3. Identify the Tournament/Results API

Look for requests with names like:
- `results`
- `tournaments`
- `matches`
- `user-tournaments`
- GraphQL endpoints

**Click on the request** and check:

#### Headers Tab
```
Request URL: https://sendou.ink/api/...
Request Method: GET or POST
```

#### Response Tab
Look at the JSON structure. It might look like:
```json
{
  "tournaments": [
    {
      "id": "...",
      "name": "Tournament Name",
      "date": "...",
      "placement": 1,
      "team": {...},
      "opponents": [...]
    }
  ]
}
```

### 4. Important Questions to Answer

Once you find the API call:

**A. What's the endpoint URL?**
- Example: `https://sendou.ink/api/user/USERNAME/results`
- Or: `https://sendou.ink/api/graphql` (if GraphQL)

**B. What parameters does it use?**
- In the URL: `?limit=20&offset=0`
- In the request body (for POST/GraphQL)

**C. What's the response structure?**
- Where is the tournament list?
- What fields are available? (tournament name, date, link, opponents, teams, etc.)
- Is there opponent/team information?

**D. Does it require authentication?**
- Check the **Headers** tab for:
  - `Authorization: Bearer ...`
  - `Cookie: ...`
  - Any custom auth headers

### 5. Test the API Directly

Once you have the endpoint, test it in the Console:

```javascript
// Example GET request
fetch('https://sendou.ink/api/user/USERNAME/results')
  .then(r => r.json())
  .then(data => console.log('API Response:', data))
  .catch(err => console.error('Error:', err));

// Example with auth (if needed)
fetch('https://sendou.ink/api/user/USERNAME/results', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    // or other headers you saw in the Network tab
  }
})
  .then(r => r.json())
  .then(data => console.log('API Response:', data));
```

## What We Need to Find

For the extension to work, we need to know:

### Option A: User Results Endpoint
If there's an endpoint that returns a user's tournament results:
```
GET /api/user/{username}/results
```

The extension will:
1. Fetch User A's results
2. Fetch User B's results
3. Find common tournaments
4. Show the last 3 matches

### Option B: Match Comparison Endpoint
If there's an endpoint that directly compares two users:
```
GET /api/matches?user1={username1}&user2={username2}
```

This would be ideal! The extension can directly fetch head-to-head data.

### Option C: Tournament Detail Endpoint
If we need to check individual tournaments:
```
GET /api/tournament/{tournamentId}
```

Then check participants to see if both users were there.

## Common Sendou.ink Patterns

Based on typical Splatoon community sites, look for:

**User Profile Data:**
```
/api/user/{username}
/api/user/{username}/tournaments
/api/user/{username}/results
```

**Tournament Data:**
```
/api/tournament/{id}
/api/tournament/{id}/matches
/api/tournament/{id}/bracket
```

**GraphQL (common on modern sites):**
```
POST /api/graphql
Body: {
  "query": "query UserResults($username: String!) { ... }",
  "variables": { "username": "..." }
}
```

## Next Steps After Finding the API

Once you identify the endpoint:

1. **Share with me:**
   - The full API URL
   - Request method (GET/POST)
   - Any headers required
   - Sample response JSON

2. **I'll update the extension** to use the real API

3. **We'll test it** to make sure it works

## Pro Tip: Check for GraphQL

If you see a single endpoint called `/api/graphql` or `/graphql`:

1. Click on the request
2. Go to **Payload** or **Request** tab
3. Look at the `query` field - this shows what data is being requested
4. The response will show the exact data structure

GraphQL example:
```javascript
// Request
{
  "query": "query UserTournaments($username: String!) {
    user(username: $username) {
      tournaments {
        id
        name
        date
        placement
      }
    }
  }",
  "variables": {
    "username": "playerName"
  }
}
```

## Screenshot Tip

If you're stuck, take screenshots of:
1. The Network tab showing the API requests
2. The Headers tab of a promising request
3. The Response tab showing the data structure

And share them - I can help interpret what you're seeing!
