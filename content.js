// Content script for sendou.ink Match History Extension

class MatchHistoryExtension {
  constructor() {
    this.DEBUG = true; // Set to false to disable debug logging
    this.loggedInUser = null;
    this.showTournaments = true; // Default to true
    this.showWeapons = true; // Default to true
    this.lutiData = null; // LUTI division lookup: username/customUrl -> {division, teamName, teamId}
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

    // Load LUTI division data
    await this.loadLutiData();

    // Get logged-in user (retry until found since React may not have rendered yet)
    await this.getLoggedInUser();
    if (!this.loggedInUser) {
      this.retryUserDetection();
    }

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

  async loadLutiData() {
    try {
      const url = chrome.runtime.getURL('data/luti_s17_divisions.json');
      const response = await fetch(url);
      const teams = await response.json();
      // Build lookup by lowercase username and customUrl
      this.lutiData = new Map();
      for (const team of teams) {
        const info = { division: team.division, teamName: team.teamName, teamId: team.teamId };
        for (const player of team.players) {
          this.lutiData.set(player.username.toLowerCase(), info);
          if (player.customUrl) {
            this.lutiData.set(player.customUrl.toLowerCase(), info);
          }
          if (player.discordId) {
            this.lutiData.set(player.discordId, info);
          }
        }
      }
      this.log(`Loaded LUTI data: ${this.lutiData.size} player entries`);
    } catch (e) {
      this.error('Could not load LUTI division data:', e);
    }
  }

  getLutiInfo(username) {
    if (!this.lutiData) return null;
    return this.lutiData.get(username.toLowerCase()) || null;
  }

  normalizeUsername(username) {
    if (typeof username !== 'string') return null;

    let normalized = username.trim();
    if (!normalized) return null;

    try {
      normalized = decodeURIComponent(normalized);
    } catch (e) {
      // Keep the original value if it is not valid URI-encoded text.
    }

    normalized = normalized
      .replace(/^https?:\/\/sendou\.ink\/u\//i, '')
      .replace(/^\/u\//i, '')
      .split(/[?#]/)[0]
      .replace(/\/+$/, '')
      .trim();

    if (!normalized || normalized.includes('/')) return null;

    const ignoredRoutes = new Set(['login', 'logout', 'register', 'settings']);
    if (ignoredRoutes.has(normalized.toLowerCase())) return null;

    return normalized;
  }

  setLoggedInUser(username, source, options = {}) {
    const normalized = this.normalizeUsername(username);
    if (!normalized) return false;

    this.loggedInUser = normalized;
    this.log(`✓ Found logged-in user via ${source}:`, this.loggedInUser);

    if (options.persist) {
      this.saveDetectedUsername(normalized);
    }

    return true;
  }

  async saveDetectedUsername(username) {
    try {
      await chrome.storage.local.set({ detectedUsername: username });
    } catch (e) {
      this.log('Could not save detected username:', e.message);
    }
  }

  async clearDetectedUsername() {
    try {
      await chrome.storage.local.remove(['detectedUsername']);
    } catch (e) {
      this.log('Could not clear detected username:', e.message);
    }
  }

  async getLoggedInUser() {
    this.log('Detecting logged-in user...');

    // Method 1: Check if manually set via extension storage (highest priority)
    let detectedUsername = null;
    try {
      const result = await chrome.storage.local.get(['manualUsername', 'detectedUsername']);
      if (result.manualUsername) {
        if (this.setLoggedInUser(result.manualUsername, 'manual setting')) {
          return;
        }
      }
      detectedUsername = result.detectedUsername || null;
    } catch (e) {
      // Chrome storage not available, skip
    }

    // Method 2: Parse React Router root loader data embedded in <script> tags
    // The root loader user is the logged-in viewer. Route-level users are profile owners.
    if (this.detectLoggedInUserFromReactRouterContext()) {
      return;
    }

    // Method 3: Check localStorage JSON blobs for a current user object
    if (this.detectLoggedInUserFromLocalStorage()) {
      return;
    }

    if (this.pageShowsLoggedOutState()) {
      await this.clearDetectedUsername();
      this.log('Page appears logged out; cleared stored detected username');
      return;
    }

    // Method 4: Reuse last trusted auto-detection across sendou.ink pages
    if (detectedUsername && this.setLoggedInUser(detectedUsername, 'stored auto-detection')) {
      return;
    }

    // Method 5: Look for a current-user profile link in the site header
    if (this.detectLoggedInUserFromHeader()) {
      return;
    }

    this.log('Could not detect logged-in user yet, will retry...');
  }

  detectLoggedInUserFromReactRouterContext() {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || !text.includes('__reactRouterContext') || !text.includes('streamController.enqueue')) continue;

      const enqueueStrings = this.extractEnqueuedStrings(text);

      for (const enqueuedString of enqueueStrings) {
        try {
          const data = JSON.parse(enqueuedString);
          const username = this.findLoggedInUserInReactRouterData(data);
          if (username && this.setLoggedInUser(username, 'React Router root loader', { persist: true })) {
            return true;
          }
        } catch (e) {
          this.log('Failed to parse React Router context chunk:', e.message);
        }
      }
    }

    return false;
  }

  findLoggedInUserInReactRouterData(data) {
    if (!Array.isArray(data)) return null;

    for (let i = 0; i < data.length; i++) {
      if (data[i] !== 'loaderData' || !data[i + 1] || typeof data[i + 1] !== 'object') continue;

      const rootLoaderData = this.getReactRouterObjectFieldValue(data[i + 1], data, 'root');
      const loggedInUser = this.getReactRouterObjectFieldValue(rootLoaderData, data, 'user');
      const username = this.extractUsernameFromReactRouterValue(loggedInUser, data);
      if (username) return username;
    }

    return null;
  }

  extractEnqueuedStrings(text) {
    const enqueueStrings = [];
    const enqueueCallRegex = /streamController\.enqueue\(\s*(["'])((?:\\.|(?!\1)[\s\S])*)\1\s*\)/g;
    let match;

    while ((match = enqueueCallRegex.exec(text)) !== null) {
      try {
        enqueueStrings.push(JSON.parse(match[1] + match[2] + match[1]));
      } catch (e) {
        this.log('Failed to unescape React Router context chunk:', e.message);
      }
    }

    return enqueueStrings;
  }

  // Kept for compatibility with older debug snippets and tests.
  findUserInReactRouterData(data) {
    if (!Array.isArray(data)) return null;

    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      if (current === 'user' && i + 1 < data.length) {
        const username = this.extractUsernameFromReactRouterValue(data[i + 1], data);
        if (username) return username;
      }
    }

    for (const item of data) {
      const username = this.extractUsernameFromReactRouterValue(item, data);
      if (username) return username;
    }

    return null;
  }

  extractUsernameFromReactRouterValue(value, data) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const customUrl = this.getReactRouterObjectFieldValue(value, data, 'customUrl');
    if (customUrl) return customUrl;

    return this.getReactRouterObjectFieldValue(value, data, 'username');
  }

  getReactRouterObjectFieldValue(obj, data, fieldName) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

    if (typeof obj[fieldName] === 'string') {
      return obj[fieldName];
    }
    if (Object.prototype.hasOwnProperty.call(obj, fieldName)) {
      return obj[fieldName];
    }

    for (const k in obj) {
      const valIdx = obj[k];
      if (typeof valIdx !== 'number' || valIdx < 0 || valIdx >= data.length) continue;

      const keyIdx = k.startsWith('_') ? parseInt(k.slice(1), 10) : NaN;
      if (!Number.isNaN(keyIdx) && keyIdx >= 0 && keyIdx < data.length && data[keyIdx] === fieldName) {
        return data[valIdx];
      }
    }

    return null;
  }

  detectLoggedInUserFromLocalStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        if (!key || !/user|session|auth|viewer|me/i.test(key)) continue;
        if (!value || !/[{[]/.test(value) || !/customUrl|username/i.test(value)) continue;

        try {
          const parsed = JSON.parse(value);
          const username = this.findUsernameInObject(parsed);
          if (username && this.setLoggedInUser(username, 'localStorage', { persist: true })) {
            return true;
          }
        } catch (e) {
          // Ignore non-JSON localStorage entries.
        }
      }
    } catch (e) {
      this.log('Could not read localStorage:', e.message);
    }

    return false;
  }

  findUsernameInObject(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 6) return null;

    if (typeof value.customUrl === 'string') return value.customUrl;
    if (typeof value.username === 'string') return value.username;

    for (const child of Object.values(value)) {
      const username = this.findUsernameInObject(child, depth + 1);
      if (username) return username;
    }

    return null;
  }

  detectLoggedInUserFromHeader() {
    const selectors = [
      'header a[href*="/u/"]',
      '[class*="header" i] a[href*="/u/"]'
    ];

    for (const selector of selectors) {
      for (const link of document.querySelectorAll(selector)) {
        const username = this.extractUsernameFromHref(link.getAttribute('href'));
        if (username && this.setLoggedInUser(username, 'header link', { persist: true })) {
          return true;
        }
      }
    }

    return false;
  }

  pageShowsLoggedOutState() {
    const headerText = document.querySelector('header')?.textContent || '';
    const hasLoginButton = Array.from(document.querySelectorAll('header button, header a')).some((element) => {
      return element.textContent?.trim().toLowerCase() === 'login';
    });

    return hasLoginButton || /\bLogin\b/.test(headerText);
  }

  extractUsernameFromHref(href) {
    if (!href) return null;

    try {
      const url = new URL(href, window.location.origin);
      if (url.hostname !== 'sendou.ink' || !url.pathname.startsWith('/u/')) return null;
      return this.normalizeUsername(url.pathname.slice(3));
    } catch (e) {
      const match = href.match(/\/u\/([^\/\?#]+)/);
      return match ? this.normalizeUsername(match[1]) : null;
    }
  }

  retryUserDetection() {
    let attempts = 0;
    const maxAttempts = 20;
    const intervalId = setInterval(async () => {
      attempts++;
      await this.getLoggedInUser();
      if (this.loggedInUser || attempts >= maxAttempts) {
        clearInterval(intervalId);
        if (this.loggedInUser) {
          this.processExistingUsers();
        }
        if (!this.loggedInUser) {
          this.error('✗ Could not detect logged-in user after retries. Are you logged in?');
          this.error('  You can manually set your username by clicking the extension icon');
        }
      }
    }, 500);
  }

  observePage() {
    // Use MutationObserver to detect dynamically added user elements
    let timeoutId = null;
    const observer = new MutationObserver((mutations) => {
      // Debounce to avoid processing too frequently
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        this.processExistingUsers();
      }, 100);
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

      // Skip if already wrapped (check if parent is our wrapper)
      if (link.parentElement?.classList.contains('match-history-wrapper')) {
        return;
      }

      const href = link.getAttribute('href');
      const username = this.extractUsernameFromHref(href);

      if (username) {
        // Skip if it's the logged-in user
        if (this.loggedInUser && username.toLowerCase() === this.loggedInUser.toLowerCase()) {
          return;
        }

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
    // Check if this specific user link is already wrapped
    if (userElement.parentElement.classList.contains('match-history-wrapper')) {
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
      await this.getLoggedInUser();
    }

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
        let lutiBannerHTML = '';
        const lutiInfo = this.getLutiInfo(username);
        if (lutiInfo) {
          const teamUrl = `https://sendou.ink/to/3192/teams/${lutiInfo.teamId}`;
          lutiBannerHTML = `
            <div class="luti-division-banner">
              <span class="luti-division-label">LUTI S17</span>
              <span class="luti-division-value">Division ${this.escapeHtml(lutiInfo.division)}</span>
              <a href="${teamUrl}" target="_blank" class="luti-team-link">${this.escapeHtml(lutiInfo.teamName)}</a>
            </div>
          `;
        }
        contentElement.innerHTML = `
          ${lutiBannerHTML}
          <div class="match-history-empty">
            No shared tourneys found between you and ${username}
          </div>
        `;
        return;
      }

      // Render matches with time range info
      this.renderMatches(result.matches, result.timeRangeMonths, contentElement, username);
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

      const weapons = this.extractWeaponsFromProfile(doc);
      this.log(`Total weapons extracted: ${weapons.length}`);

      if (weapons.length === 0) {
        contentElement.innerHTML = `
          <div class="match-history-empty">
            No weapons listed on ${username}'s profile
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

  extractWeaponsFromProfile(doc) {
    // sendou.ink has moved these assets between static-assets and CDN-backed paths.
    const weaponElements = doc.querySelectorAll([
      'img[src*="main-weapons-outlined"]',
      'img[data-testid][src*="/img/main-weapons"]'
    ].join(', '));
    this.log(`Found ${weaponElements.length} weapon elements`);

    const seen = new Set();
    const weapons = [];
    for (const img of weaponElements) {
      const wrapperTitle = img.closest('[title]')?.getAttribute('title');
      const weaponName = img.getAttribute('alt') || img.getAttribute('title') || wrapperTitle || 'Unknown Weapon';
      let weaponImage = img.getAttribute('src') || '';

      // Convert relative URLs to absolute URLs
      if (weaponImage.startsWith('//')) {
        weaponImage = window.location.protocol + weaponImage;
      } else if (weaponImage && !weaponImage.startsWith('http')) {
        weaponImage = 'https://sendou.ink' + weaponImage;
      }

      const dedupeKey = `${weaponName}|${weaponImage}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      this.log(`Extracted weapon: ${weaponName}, image: ${weaponImage}`);

      weapons.push({
        name: weaponName,
        image: weaponImage
      });
    }

    return weapons;
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

  renderMatches(matches, timeRangeMonths, contentElement, username) {
    // Create header text based on number of tournaments and time range
    const count = matches.length;
    const monthText = timeRangeMonths === 1 ? 'month' : 'months';
    const tourneyText = count === 1 ? 'shared tourney' : 'shared tourneys';
    const headerText = `${count} ${tourneyText} in the last ${timeRangeMonths} ${monthText}`;

    // Build LUTI division banner if available
    let lutiBannerHTML = '';
    if (username) {
      const lutiInfo = this.getLutiInfo(username);
      if (lutiInfo) {
        const teamUrl = `https://sendou.ink/to/3192/teams/${lutiInfo.teamId}`;
        lutiBannerHTML = `
          <div class="luti-division-banner">
            <span class="luti-division-label">LUTI S17</span>
            <span class="luti-division-value">Division ${this.escapeHtml(lutiInfo.division)}</span>
            <a href="${teamUrl}" target="_blank" class="luti-team-link">${this.escapeHtml(lutiInfo.teamName)}</a>
          </div>
        `;
      }
    }

    const html = `
      <div class="match-history-list">
        ${lutiBannerHTML}
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
