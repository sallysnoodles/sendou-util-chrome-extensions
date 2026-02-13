// Content script for sendou.ink Match History Extension

class MatchHistoryExtension {
  constructor() {
    this.DEBUG = true; // Set to false to disable debug logging
    this.loggedInUser = null;
    this.processedUsers = new Set();
    this.showTournaments = true; // Default to true
    this.showWeapons = true; // Default to true
    this.init();
  }

  log(...args) {
    if (this.DEBUG) {
      console.log('[Match History]', ...args);
    }
  }

  error(...args) {
    console.error('[Match History]', ...args);
  }

  async init() {
    // Load feature settings
    await this.loadSettings();

    // Get logged-in user
    await this.getLoggedInUser();

    // Start observing the page for user elements
    this.observePage();

    // Process existing user elements
    this.processExistingUsers();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['showTournaments', 'showWeapons']);
      this.showTournaments = result.showTournaments !== false; // Default to true
      this.showWeapons = result.showWeapons !== false; // Default to true
      this.log(`Settings loaded - Tournaments: ${this.showTournaments}, Weapons: ${this.showWeapons}`);
    } catch (e) {
      this.error('Could not load settings:', e);
    }
  }

  async getLoggedInUser() {
    this.log('Detecting logged-in user...');

    // Method 1: Check specific header layout classes (most reliable for sendou.ink)
    const headerUserSelectors = [
      '.layout__header__right-container .layout__user-item a[href*="/u/"]',
      '.layout__user-item a[href*="/u/"]',
      '.layout__header__right-container a[href*="/u/"]'
    ];

    for (const selector of headerUserSelectors) {
      this.log(`Trying selector: ${selector}`);
      const element = document.querySelector(selector);
      if (element) {
        const href = element.getAttribute('href');
        this.log(`Found element with href: ${href}`);
        const match = href?.match(/\/u\/([^\/\?#]+)/);
        if (match) {
          this.loggedInUser = match[1];
          this.log('✓ Found logged-in user via header layout:', this.loggedInUser);
          return;
        }
      }
    }

    // Method 2: Check localStorage/sessionStorage
    const storageKeys = ['user', 'currentUser', 'loggedInUser', 'auth', 'session', 'profile'];
    for (const key of storageKeys) {
      const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (stored) {
        try {
          const userData = JSON.parse(stored);
          const username = userData.username || userData.discordName || userData.name || userData.customUrl;
          if (username) {
            this.loggedInUser = username;
            this.log('✓ Found logged-in user via storage:', this.loggedInUser);
            return;
          }
        } catch (e) {
          // Not JSON, maybe it's just the username
          if (stored.length > 0 && stored.length < 50 && !stored.includes('{')) {
            this.loggedInUser = stored;
            this.log('✓ Found logged-in user via storage (plain text):', this.loggedInUser);
            return;
          }
        }
      }
    }

    // Method 3: Check for user menu or settings link
    const userMenuSelectors = [
      '[data-testid="user-menu"] a[href*="/u/"]',
      '[aria-label*="User menu"] a[href*="/u/"]',
      'button[aria-label*="User"] ~ * a[href*="/u/"]',
      'a[href*="/u/"][href*="/settings"]',
      'a[href*="/u/"][aria-label*="Profile"]',
    ];

    for (const selector of userMenuSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const href = element.getAttribute('href');
        const match = href?.match(/\/u\/([^\/\?#]+)/);
        if (match) {
          this.loggedInUser = match[1];
          this.log('✓ Found logged-in user via user menu:', this.loggedInUser);
          return;
        }
      }
    }

    // Method 4: Check if manually set via extension storage
    try {
      const result = await chrome.storage.local.get(['manualUsername']);
      if (result.manualUsername) {
        this.loggedInUser = result.manualUsername;
        this.log('✓ Using manually set username:', this.loggedInUser);
        return;
      }
    } catch (e) {
      // Chrome storage not available, skip
    }

    this.error('✗ Could not detect logged-in user. Are you logged in?');
    this.error('  The extension requires you to be logged in to sendou.ink');
    this.error('  You can manually set your username by clicking the extension icon');
    this.error('  Or run in console: chrome.storage.local.set({ manualUsername: "yourUsername" })');
  }

  observePage() {
    // Use MutationObserver to detect dynamically added user elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          this.processExistingUsers();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processExistingUsers() {
    // Find all user links on the page, excluding header, footer, and nav
    const userLinks = document.querySelectorAll('a[href*="/u/"]');

    userLinks.forEach(link => {
      // Skip if link is in header, footer, or nav (these are navigation, not content)
      if (this.isInHeaderFooterOrNav(link)) {
        return;
      }

      const href = link.getAttribute('href');
      const match = href.match(/\/u\/([^\/\?#]+)/);

      if (match) {
        const username = match[1];
        const uniqueId = `${href}-${link.textContent}`;

        // Skip if already processed or if it's the logged-in user
        if (this.processedUsers.has(uniqueId) || username === this.loggedInUser) {
          return;
        }

        this.processedUsers.add(uniqueId);
        this.addMatchHistoryBlock(link, username);
      }
    });
  }

  isInHeaderFooterOrNav(element) {
    // Check if element is inside header, footer, or nav
    let current = element;
    while (current && current !== document.body) {
      const tagName = current.tagName?.toLowerCase();
      if (tagName === 'header' || tagName === 'footer' || tagName === 'nav') {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  addMatchHistoryBlock(userElement, username) {
    // Check if already has a match history block
    if (userElement.parentElement.querySelector('.match-history-container')) {
      return;
    }

    // Check if any features are enabled
    if (!this.showTournaments && !this.showWeapons) {
      return; // Don't add anything if both features are disabled
    }

    // Create wrapper to keep link and icons inline
    const wrapper = document.createElement('span');
    wrapper.className = 'match-history-wrapper';

    wrapper.appendChild(userElement.cloneNode(true));

    // Create the shared tournaments expandable block (if enabled)
    if (this.showTournaments) {
      const tournamentsContainer = document.createElement('span');
      tournamentsContainer.className = 'match-history-container';

      const tournamentsToggle = document.createElement('button');
      tournamentsToggle.className = 'match-history-toggle';
      tournamentsToggle.textContent = '📊';
      tournamentsToggle.title = 'View shared tournaments';

      const tournamentsContent = document.createElement('div');
      tournamentsContent.className = 'match-history-content';
      tournamentsContent.style.display = 'none';

      const tournamentsLoadingText = document.createElement('div');
      tournamentsLoadingText.className = 'match-history-loading';
      tournamentsLoadingText.textContent = 'Loading shared tournaments...';
      tournamentsContent.appendChild(tournamentsLoadingText);

      tournamentsContainer.appendChild(tournamentsToggle);
      tournamentsContainer.appendChild(tournamentsContent);

      wrapper.appendChild(tournamentsContainer);

      // Hover functionality for tournaments
      let tournamentsLoaded = false;
      tournamentsContainer.addEventListener('mouseenter', async (e) => {
        tournamentsContent.style.display = 'block';
        tournamentsToggle.classList.add('active');

        // Load match history on first hover
        if (!tournamentsLoaded) {
          tournamentsLoaded = true;
          await this.loadMatchHistory(username, tournamentsContent);
        }
      });

      tournamentsContainer.addEventListener('mouseleave', (e) => {
        tournamentsContent.style.display = 'none';
        tournamentsToggle.classList.remove('active');
      });
    }

    // Create the weapons expandable block (if enabled)
    if (this.showWeapons) {
      const weaponsContainer = document.createElement('span');
      weaponsContainer.className = 'match-history-container weapons-container';

      const weaponsToggle = document.createElement('button');
      weaponsToggle.className = 'match-history-toggle weapons-toggle';
      weaponsToggle.textContent = '🔫';
      weaponsToggle.title = 'View weapons';

      const weaponsContent = document.createElement('div');
      weaponsContent.className = 'match-history-content weapons-content';
      weaponsContent.style.display = 'none';

      const weaponsLoadingText = document.createElement('div');
      weaponsLoadingText.className = 'match-history-loading';
      weaponsLoadingText.textContent = 'Loading weapons...';
      weaponsContent.appendChild(weaponsLoadingText);

      weaponsContainer.appendChild(weaponsToggle);
      weaponsContainer.appendChild(weaponsContent);

      wrapper.appendChild(weaponsContainer);

      // Hover functionality for weapons
      let weaponsLoaded = false;
      weaponsContainer.addEventListener('mouseenter', async (e) => {
        weaponsContent.style.display = 'block';
        weaponsToggle.classList.add('active');

        // Load weapons on first hover
        if (!weaponsLoaded) {
          weaponsLoaded = true;
          await this.loadWeapons(username, weaponsContent);
        }
      });

      weaponsContainer.addEventListener('mouseleave', (e) => {
        weaponsContent.style.display = 'none';
        weaponsToggle.classList.remove('active');
      });
    }

    // Wrap the user link and icons together to keep them inline
    const parent = userElement.parentElement;
    parent.replaceChild(wrapper, userElement);
  }

  async loadMatchHistory(username, contentElement) {
    this.log(`Loading shared tournaments for: ${username}`);

    if (!this.loggedInUser) {
      this.error('Cannot load shared tournaments - not logged in');
      contentElement.innerHTML = '<div class="match-history-error">Please log in to view shared tournaments</div>';
      return;
    }

    this.log(`Comparing ${this.loggedInUser} vs ${username}`);

    try {
      // Fetch match history from sendou.ink API
      const result = await this.fetchMatches(username);

      this.log(`Found ${result.matches.length} shared tourneys`);

      if (result.matches.length === 0) {
        contentElement.innerHTML = `
          <div class="match-history-empty">
            No shared tourneys found between you and ${username}
          </div>
        `;
        return;
      }

      // Render matches with time range info
      this.renderMatches(result.matches, result.timeRangeMonths, contentElement);
    } catch (error) {
      this.error('Error loading shared tournaments:', error);
      contentElement.innerHTML = `
        <div class="match-history-error">
          Failed to load shared tournaments
          ${this.DEBUG ? `<br><small style="opacity:0.7">Error: ${error.message}</small>` : ''}
        </div>
      `;
    }
  }

  async loadWeapons(username, contentElement) {
    this.log(`Loading weapons for: ${username}`);

    try {
      // Fetch the user's profile page HTML
      const profileUrl = `https://sendou.ink/u/${username}`;
      this.log(`Fetching profile page: ${profileUrl}`);

      const response = await fetch(profileUrl);

      if (!response.ok) {
        this.error(`Failed to fetch profile page: ${response.status}`);
        contentElement.innerHTML = `
          <div class="match-history-error">
            Failed to load profile page (${response.status})
          </div>
        `;
        return;
      }

      const html = await response.text();
      this.log(`Fetched HTML, length: ${html.length}`);

      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Find weapon elements in the parsed HTML
      const weaponElements = doc.querySelectorAll('.u__weapon');
      this.log(`Found ${weaponElements.length} weapon elements`);

      if (weaponElements.length === 0) {
        contentElement.innerHTML = `
          <div class="match-history-empty">
            No weapons listed on ${username}'s profile
          </div>
        `;
        return;
      }

      // Extract weapon data
      const weapons = [];
      for (const weaponEl of weaponElements) {
        const img = weaponEl.querySelector('img');
        if (!img) continue;

        const weaponName = img.getAttribute('alt') || img.getAttribute('title') || 'Unknown Weapon';
        let weaponImage = img.getAttribute('src') || '';

        // Convert relative URLs to absolute URLs
        if (weaponImage && !weaponImage.startsWith('http')) {
          weaponImage = 'https://sendou.ink' + weaponImage;
        }

        this.log(`Extracted weapon: ${weaponName}, image: ${weaponImage}`);

        weapons.push({
          name: weaponName,
          image: weaponImage
        });
      }

      this.log(`Total weapons extracted: ${weapons.length}`);

      if (weapons.length === 0) {
        contentElement.innerHTML = `
          <div class="match-history-empty">
            No weapons data found
          </div>
        `;
        return;
      }

      // Render weapons
      this.renderWeapons(weapons, username, contentElement);
    } catch (error) {
      this.error('Error loading weapons:', error);
      contentElement.innerHTML = `
        <div class="match-history-error">
          Failed to load weapons
          ${this.DEBUG ? `<br><small style="opacity:0.7">Error: ${error.message}</small>` : ''}
        </div>
      `;
    }
  }

  renderWeapons(weapons, username, contentElement) {
    const html = `
      <div class="weapons-list">
        <div class="match-history-header">Weapons on Profile</div>
        ${weapons.map(weapon => `
          <div class="weapon-item">
            <img src="${weapon.image}" alt="${this.escapeHtml(weapon.name)}" class="weapon-image" />
            <span class="weapon-name">${this.escapeHtml(weapon.name)}</span>
          </div>
        `).join('')}
      </div>
    `;

    contentElement.innerHTML = html;
  }

  async fetchMatches(username) {
    this.log(`Fetching matches between ${this.loggedInUser} and ${username}`);

    try {
      // Fetch tournament results for both users
      this.log('Fetching results for both users...');
      const [loggedInResults, otherUserResults] = await Promise.all([
        this.fetchUserResults(this.loggedInUser),
        this.fetchUserResults(username)
      ]);

      if (!loggedInResults) {
        this.error(`Failed to fetch results for logged-in user: ${this.loggedInUser}`);
        throw new Error(`Could not load your tournament history`);
      }

      if (!otherUserResults) {
        this.error(`Failed to fetch results for other user: ${username}`);
        throw new Error(`Could not load ${username}'s tournament history`);
      }

      this.log(`User ${this.loggedInUser}: ${loggedInResults.length} tournaments`);
      this.log(`User ${username}: ${otherUserResults.length} tournaments`);

      // Calculate time range for both users
      const timeRange1 = this.calculateTimeRange(loggedInResults);
      const timeRange2 = this.calculateTimeRange(otherUserResults);

      this.log(`${this.loggedInUser} history: ${timeRange1} months`);
      this.log(`${username} history: ${timeRange2} months`);

      // Use the shorter time range, capped at 12 months
      const timeRangeMonths = Math.min(Math.min(timeRange1, timeRange2), 12);
      this.log(`Using time range: ${timeRangeMonths} months (shorter of the two, capped at 12)`);

      // Find common tournaments (pass username for teammate detection)
      const commonTournaments = this.findCommonTournaments(loggedInResults, otherUserResults, username);

      this.log(`Found ${commonTournaments.length} shared tourneys`);

      // Return all common tournaments with time range info
      return {
        matches: commonTournaments,
        totalCommon: commonTournaments.length,
        timeRangeMonths: timeRangeMonths
      };
    } catch (error) {
      this.error('API Error:', error);
      throw error;
    }
  }

  calculateTimeRange(tournaments) {
    if (!tournaments || tournaments.length === 0) return 0;

    // Find earliest and latest tournaments
    const timestamps = tournaments
      .map(t => t.startTime)
      .filter(t => t && t > 0)
      .sort((a, b) => a - b);

    if (timestamps.length === 0) return 0;

    const earliest = timestamps[0];
    const latest = timestamps[timestamps.length - 1];

    // Calculate difference in months
    const diffMs = (latest - earliest) * 1000; // Convert to milliseconds
    const diffMonths = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)); // Average month length

    return Math.max(diffMonths, 1); // At least 1 month
  }

  async fetchUserResults(username) {
    this.log(`Fetching results for: ${username}`);

    try {
      const url = `https://sendou.ink/u/${username}/results.data?all=true`;
      this.log(`Fetching from: ${url}`);
      const response = await fetch(url);

      this.log(`Response status for ${username}: ${response.status}`);

      if (!response.ok) {
        this.error(`API returned ${response.status} for ${username}`);
        if (response.status === 404) {
          this.error(`User ${username} might not exist or has no results page`);
        }
        throw new Error(`Failed to fetch results for ${username} (${response.status})`);
      }

      const data = await response.json();
      this.log(`Received data for ${username}: ${data.length} items in array`);

      if (!Array.isArray(data) || data.length === 0) {
        this.error(`Invalid data format for ${username}`);
        return [];
      }

      const parsed = this.parseResults(data);
      this.log(`Parsed ${parsed.length} tournaments for ${username}`);

      if (parsed.length === 0) {
        this.log(`⚠️ No tournaments parsed for ${username}. Raw data length: ${data.length}`);
        this.log(`First few items:`, data.slice(0, 5));
      }

      return parsed;
    } catch (error) {
      this.error(`Error fetching results for ${username}:`, error);
      this.error(`Error details:`, error.message);
      return null;
    }
  }

  parseResults(data) {
    // Parse the Remix-style encoded response
    // The format uses numeric references to look up values in the main data array
    // IMPORTANT: Handle both highlighted and non-highlighted tournaments
    try {
      const results = [];
      const seenIds = new Set(); // Prevent duplicates

      // Helper function to resolve a value (might be a reference to data array)
      const resolve = (val) => {
        if (typeof val === 'number' && val >= 0 && val < data.length) {
          return data[val];
        }
        return val;
      };

      // Find ALL "value" arrays that contain tournament data
      // Users might have highlighted tournaments, which creates multiple sections
      const valueArrayIndices = [];

      for (let i = 0; i < data.length; i++) {
        if (data[i] === "value" && i + 1 < data.length && Array.isArray(data[i + 1])) {
          // Check if this value array contains tournament-like objects
          const arr = data[i + 1];
          if (arr.length > 0) {
            // Peek at the first item to see if it looks like a tournament reference
            const firstItem = resolve(arr[0]);
            if (firstItem && typeof firstItem === 'object') {
              valueArrayIndices.push(i + 1);
              this.log(`Found value array at index ${i + 1} with ${arr.length} items`);
            }
          }
        }
      }

      if (valueArrayIndices.length === 0) {
        this.error('Could not find any "value" arrays in API response');
        return results;
      }

      this.log(`Found ${valueArrayIndices.length} value array(s) - processing all for tournaments`);

      // Parse tournaments from ALL value arrays (highlighted + non-highlighted)
      for (const valueArrayIndex of valueArrayIndices) {
        const tournamentRefs = data[valueArrayIndex];
        this.log(`Processing array at index ${valueArrayIndex} with ${tournamentRefs.length} items`);

        let parsedFromThisArray = 0;

        for (const ref of tournamentRefs) {
          const tournamentObj = resolve(ref);
          if (!tournamentObj || typeof tournamentObj !== 'object') continue;

          const tournament = {
            tournamentId: null,
            eventName: null,
            startTime: null,
            placement: null,
            logoUrl: null,
            division: null,
            teammates: [],
            teamCount: null
          };

          // Resolve all values in the tournament object
          for (const key in tournamentObj) {
            const value = resolve(tournamentObj[key]);

            // Try to identify what each value is
            if (typeof value === 'number') {
              // Tournament IDs are typically 4-digit numbers
              if (value > 1000 && value < 10000 && !tournament.tournamentId) {
                tournament.tournamentId = value;
              }
              // Placements are small numbers
              else if (value > 0 && value < 200 && !tournament.placement) {
                tournament.placement = value;
              }
              // Team count (typically 4-128 teams, comes after placement)
              else if (value > 0 && value < 200 && tournament.placement && !tournament.teamCount) {
                tournament.teamCount = value;
              }
              // Timestamps are large numbers
              else if (value > 1700000000 && value < 2000000000) {
                tournament.startTime = value;
              }
            } else if (Array.isArray(value)) {
              // Check if this is the mates array
              // Mates array contains teammate objects with username/discordName
              const possibleMates = [];
              for (const mateRef of value) {
                const mateObj = resolve(mateRef);
                if (mateObj && typeof mateObj === 'object') {
                  // Extract username from mate object
                  for (const mateKey in mateObj) {
                    const mateValue = resolve(mateObj[mateKey]);
                    // Look for username-like strings (3-20 chars, no special chars)
                    if (typeof mateValue === 'string' &&
                        mateValue.length >= 3 && mateValue.length <= 30 &&
                        !mateValue.includes('http') && !mateValue.includes('@') &&
                        !mateValue.includes('.') && !mateValue.includes('/')) {
                      possibleMates.push(mateValue.toLowerCase());
                    }
                  }
                }
              }
              if (possibleMates.length > 0 && tournament.teammates.length === 0) {
                tournament.teammates = possibleMates;
              }
            } else if (typeof value === 'string') {
              // Division names (e.g., "Division A", "Division B")
              if (value.startsWith('Division') && value.length < 20 && !tournament.division) {
                tournament.division = value;
              }
              // Event names
              else if (value.length > 3 && value.length < 100 &&
                  !value.includes('http') && !value.includes('/') &&
                  !value.includes('.') && !tournament.eventName) {
                tournament.eventName = value;
              }
              // Logo URLs
              else if (value.includes('http') && (value.includes('logo') || value.includes('tournament'))) {
                tournament.logoUrl = value;
              }
            }
          }

          // Add tournament if valid and not duplicate
          if (tournament.tournamentId && !seenIds.has(tournament.tournamentId)) {
            seenIds.add(tournament.tournamentId);
            results.push(tournament);
            parsedFromThisArray++;
          }
        }

        this.log(`  → Parsed ${parsedFromThisArray} unique tournaments from this array`);
      }

      this.log(`✓ Total parsed: ${results.length} tournament results (across all arrays)`);
      return results;
    } catch (error) {
      this.error('Error parsing results:', error);
      return [];
    }
  }

  findCommonTournaments(results1, results2, otherUsername) {
    this.log('Finding shared tourneys...');
    this.log(`User 1 tournament IDs: [${results1.map(t => t.tournamentId).slice(0, 10).join(', ')}...]`);
    this.log(`User 2 tournament IDs: [${results2.map(t => t.tournamentId).slice(0, 10).join(', ')}...]`);

    const tournamentMap = new Map();

    // Create a map of tournaments from results1
    for (const tournament of results1) {
      if (tournament.tournamentId) {
        tournamentMap.set(tournament.tournamentId, tournament);
      }
    }

    this.log(`Tournament map has ${tournamentMap.size} entries`);

    // Find tournaments that appear in both results
    const commonTournaments = [];
    for (const tournament of results2) {
      if (tournament.tournamentId && tournamentMap.has(tournament.tournamentId)) {
        // Get tournament data from both users
        const tournament1 = tournamentMap.get(tournament.tournamentId);
        const tournament2 = tournament;

        // Check if they were teammates by looking in mates array
        const otherUsernameLower = otherUsername.toLowerCase();
        const wereTeammates = tournament1.teammates &&
                              tournament1.teammates.length > 0 &&
                              tournament1.teammates.some(mate => mate.toLowerCase() === otherUsernameLower);

        if (wereTeammates) {
          this.log(`✓ Shared tourney found: ${tournament.tournamentId} - ${tournament1.eventName} (Teammates #${tournament1.placement || '?'})`);
        } else {
          this.log(`✓ Shared tourney found: ${tournament.tournamentId} - ${tournament1.eventName} (You: #${tournament1.placement || '?'}, Them: #${tournament2.placement || '?'})`);
        }

        // Store both placements, divisions, team count, and teammate status
        commonTournaments.push({
          ...tournament1,
          yourPlacement: tournament1.placement,
          theirPlacement: tournament2.placement,
          yourDivision: tournament1.division,
          theirDivision: tournament2.division,
          teamCount: tournament1.teamCount,
          wereTeammates: wereTeammates
        });
      }
    }

    if (commonTournaments.length === 0) {
      this.log('⚠️ No shared tourneys found. Checking for issues...');
      // Show some tournament IDs from each user for debugging
      const ids1 = results1.map(t => t.tournamentId).slice(0, 5);
      const ids2 = results2.map(t => t.tournamentId).slice(0, 5);
      this.log(`Sample IDs from user 1: ${ids1.join(', ')}`);
      this.log(`Sample IDs from user 2: ${ids2.join(', ')}`);
    }

    // Sort by startTime (most recent first)
    commonTournaments.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

    return commonTournaments.map(t => ({
      tournamentId: t.tournamentId,
      tournamentName: t.eventName || 'Unknown Tournament',
      url: `https://sendou.ink/to/${t.tournamentId}/results`,
      date: t.startTime ? new Date(t.startTime * 1000).toISOString() : null,
      yourPlacement: t.yourPlacement,
      theirPlacement: t.theirPlacement,
      yourDivision: t.yourDivision,
      theirDivision: t.theirDivision,
      teamCount: t.teamCount,
      wereTeammates: t.wereTeammates
    }));
  }

  renderMatches(matches, timeRangeMonths, contentElement) {
    // Create header text based on number of tournaments and time range
    const count = matches.length;
    const monthText = timeRangeMonths === 1 ? 'month' : 'months';
    const tourneyText = count === 1 ? 'shared tourney' : 'shared tourneys';
    const headerText = `${count} ${tourneyText} in the last ${timeRangeMonths} ${monthText}`;

    const html = `
      <div class="match-history-list">
        <div class="match-history-header">${headerText}</div>
        ${matches.map(match => {
          // Check if they were teammates (from mates data, not just same placement)
          const wereTeammates = match.wereTeammates;

          let placementHTML = '';
          if (wereTeammates) {
            // Show teammates badge instead of separate placements
            const division = match.yourDivision || match.theirDivision;
            placementHTML = `<span class="placement-badge placement-teammates">❤️ Teammates: #${match.yourPlacement}${division ? ` (${division})` : ''}</span>`;
          } else {
            // Show separate placement badges
            placementHTML = `
              ${match.yourPlacement ? `<span class="placement-badge placement-you">You: #${match.yourPlacement}${match.yourDivision ? ` (${match.yourDivision})` : ''}</span>` : ''}
              ${match.theirPlacement ? `<span class="placement-badge placement-them">Them: #${match.theirPlacement}${match.theirDivision ? ` (${match.theirDivision})` : ''}</span>` : ''}
            `;
          }

          const teamCountText = match.teamCount ? ` (${match.teamCount} teams)` : '';

          return `
          <div class="match-history-item">
            <a href="${match.url || '#'}" target="_blank" class="match-history-link">
              <div class="match-tournament-name">
                ${this.escapeHtml(match.tournamentName || 'Unknown Tournament')}${teamCountText}
              </div>
              <div class="match-placements">
                ${placementHTML}
              </div>
              ${match.date ? `<div class="match-date">${this.formatDate(match.date)}</div>` : ''}
            </a>
          </div>
          `;
        }).join('')}
      </div>
    `;

    contentElement.innerHTML = html;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

// Initialize the extension when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MatchHistoryExtension();
  });
} else {
  new MatchHistoryExtension();
}
