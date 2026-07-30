// Content script for sendou.ink Match History Extension

class MatchHistoryExtension {
  constructor() {
    this.DEBUG = true; // Set to false to disable debug logging
    this.loggedInUser = null;
    this.showTournaments = true; // Default to true
    this.showWeapons = true; // Default to true
    this.tournamentLookbackMonths = 6;
    this.tournamentResultsCacheTtlMs = 12 * 60 * 60 * 1000;
    this.tournamentResultsCacheStorageKey = 'tournamentResultsCacheV2';
    this.profileWeaponsCacheTtlMs = 3 * 24 * 60 * 60 * 1000;
    this.profileWeaponsCacheStorageKey = 'profileWeaponsCacheV1';
    this.encounterMonths = 6;
    this.maxEncounters = 5;
    this.maxSendouQSeasons = 2;
    this.maxSeasonPages = 8;
    this.lutiData = null; // LUTI division lookup: customUrl/Discord ID -> {division, teamName, teamId}
    this.activePopup = null;
    this.processedUserCardTriggers = new WeakSet();
    this.userIdentifierCache = new Map();
    this.userIdentifierCandidates = new Map();
    this.userIdentifierCacheInitialized = false;
    this.userIdentifierRouteKey = null;
    this.userIdentifierRoutePromise = null;
    this.userIdentityCache = new Map();
    this.seasonHistoryCache = new Map();
    this.recentSeasonHistoryCache = new Map();
    this.tournamentBracketCache = new Map();
    this.tournamentResultsMemoryCache = new Map();
    this.tournamentResultsCacheWriteQueue = Promise.resolve();
    this.profileWeaponsMemoryCache = new Map();
    this.profileWeaponsCacheWriteQueue = Promise.resolve();
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

  decodeRemixData(data) {
    if (!Array.isArray(data)) {
      throw new Error('Expected a Remix flat data array');
    }

    const cache = new Map();
    const specialValues = new Map([
      [-1, undefined],
      [-2, NaN],
      [-3, -Infinity],
      [-4, -0],
      [-5, null],
      [-6, Infinity],
      [-7, undefined]
    ]);

    const resolveReference = (reference) =>
      reference < 0 ? specialValues.get(reference) : decodeAt(reference);

    const decodeAt = (index) => {
      if (cache.has(index)) return cache.get(index);

      const value = data[index];
      if (Array.isArray(value)) {
        const decoded = [];
        cache.set(index, decoded);
        value.forEach((item) => {
          decoded.push(typeof item === 'number' ? resolveReference(item) : item);
        });
        return decoded;
      }

      if (value && typeof value === 'object') {
        const decoded = {};
        cache.set(index, decoded);
        Object.entries(value).forEach(([key, item]) => {
          const keyReference = key.match(/^_(\d+)$/);
          const decodedKey = keyReference ? data[Number(keyReference[1])] : key;
          decoded[decodedKey] =
            typeof item === 'number' ? resolveReference(item) : item;
        });
        return decoded;
      }

      cache.set(index, value);
      return value;
    };

    return data.map((_, index) => decodeAt(index));
  }

  findDecodedRouteData(data, routeId) {
    const decoded = this.decodeRemixData(data);
    for (let index = 0; index < data.length - 1; index++) {
      if (data[index] === routeId) {
        return decoded[index + 1]?.data ?? decoded[index + 1] ?? null;
      }
    }
    return null;
  }

  cacheUserIdentity(user) {
    if (!user || typeof user !== 'object') return null;

    const id = Number(user.id);
    if (!Number.isFinite(id)) return null;

    const identity = {
      id,
      username: user.username || null,
      customUrl: user.customUrl || null,
      discordId: user.discordId ? String(user.discordId) : null
    };
    [
      identity.username,
      identity.customUrl,
      identity.discordId,
      user.inGameName
    ].forEach((value) => {
      const normalized = this.normalizeUsername(value);
      if (normalized) this.userIdentityCache.set(normalized.toLowerCase(), identity);
    });
    this.userIdentityCache.set(String(id), identity);
    return identity;
  }

  async fetchUserIdentity(identifier) {
    const normalized = this.normalizeUsername(identifier);
    const cached = normalized
      ? this.userIdentityCache.get(normalized.toLowerCase())
      : null;
    if (cached) return cached;

    const response = await fetch(
      `https://sendou.ink/u/${encodeURIComponent(identifier)}.data`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch user identity (${response.status} ${response.statusText})`
      );
    }

    const data = await response.json();
    const routeData = this.findDecodedRouteData(
      data,
      'features/user-page/routes/u.$identifier'
    );
    const identity = this.cacheUserIdentity(routeData?.user);
    if (!identity) {
      throw new Error(`Could not resolve user identity for ${identifier}`);
    }
    return identity;
  }

  getIdentityRoute(identity) {
    return identity.customUrl || identity.discordId || identity.username;
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

  cacheUserIdentifiersFromReactRouterContext() {
    if (this.userIdentifierCacheInitialized) return;
    this.userIdentifierCacheInitialized = true;

    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || !text.includes('streamController.enqueue')) continue;

      for (const enqueuedString of this.extractEnqueuedStrings(text)) {
        try {
          this.cacheUserIdentifiersFromReactRouterData(JSON.parse(enqueuedString));
        } catch (e) {
          this.log('Failed to parse user identifiers from React Router context:', e.message);
        }
      }
    }
  }

  cacheUserIdentifiersFromReactRouterData(data) {
    if (!Array.isArray(data)) return;

    for (const item of data) {
      if (typeof item === 'string') {
        const serialized = item.trim();
        if ((serialized.startsWith('{') || serialized.startsWith('[')) &&
            serialized.includes('"username"')) {
          try {
            this.cacheUserIdentifiersFromPlainValue(JSON.parse(serialized));
          } catch (e) {
            this.log('Failed to parse nested user data:', e.message);
          }
        }
        continue;
      }

      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

      const username = this.getReactRouterObjectFieldValue(item, data, 'username');
      if (typeof username !== 'string') continue;

      const customUrl = this.getReactRouterObjectFieldValue(item, data, 'customUrl');
      const discordId = this.getReactRouterObjectFieldValue(item, data, 'discordId');
      const discordAvatar = this.getReactRouterObjectFieldValue(
        item,
        data,
        'discordAvatar'
      );
      const customAvatarUrl = this.getReactRouterObjectFieldValue(
        item,
        data,
        'customAvatarUrl'
      );
      const id = this.getReactRouterObjectFieldValue(item, data, 'id');
      this.cacheUserIdentifierCandidate({
        id,
        username,
        customUrl,
        discordId,
        discordAvatar,
        customAvatarUrl
      });
    }
  }

  cacheUserIdentifiersFromPlainValue(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 10) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        this.cacheUserIdentifiersFromPlainValue(item, depth + 1);
      }
      return;
    }

    if (typeof value.username === 'string') {
      this.cacheUserIdentifierCandidate(value);
    }

    for (const child of Object.values(value)) {
      this.cacheUserIdentifiersFromPlainValue(child, depth + 1);
    }
  }

  cacheUserIdentifierCandidate(user) {
    const username =
      typeof user?.username === 'string'
        ? user.username.trim().toLowerCase()
        : null;
    if (!username) return;

    const customUrl = this.normalizeUsername(user.customUrl);
    const discordId = this.normalizeUsername(user.discordId);
    const identifier =
      customUrl ||
      discordId ||
      this.normalizeUsername(user.username);
    if (!identifier) return;

    let candidates = this.userIdentifierCandidates.get(username);
    if (!candidates) {
      candidates = new Map();
      this.userIdentifierCandidates.set(username, candidates);
    }
    const numericId = Number(user.id ?? user.userId);
    const identityKey = discordId
      ? `discord:${discordId}`
      : Number.isFinite(numericId)
        ? `id:${numericId}`
        : `identifier:${identifier.toLowerCase()}`;
    const existing = candidates.get(identityKey);
    candidates.set(identityKey, {
      identifier: customUrl || existing?.identifier || identifier,
      discordId:
        (user.discordId ? String(user.discordId) : null) ||
        existing?.discordId ||
        null,
      discordAvatar:
        user.discordAvatar || existing?.discordAvatar || null,
      customAvatarUrl:
        user.customAvatarUrl || existing?.customAvatarUrl || null
    });

    if (candidates.size === 1) {
      this.userIdentifierCache.set(
        username,
        candidates.values().next().value.identifier
      );
    } else {
      this.userIdentifierCache.delete(username);
    }
  }

  getUserIdentifier(displayUsername, trigger = null) {
    const exactDisplayName =
      typeof displayUsername === 'string'
        ? displayUsername.trim().toLowerCase()
        : null;
    if (exactDisplayName && this.userIdentifierCache.has(exactDisplayName)) {
      return this.userIdentifierCache.get(exactDisplayName);
    }
    if (exactDisplayName) {
      const candidates = this.userIdentifierCandidates.get(exactDisplayName);
      if (candidates?.size > 1) {
        return this.resolveUserIdentifierFromTrigger(candidates, trigger);
      }
    }

    const avatarMatchedIdentifier = trigger
      ? this.resolveUserIdentifierFromAnyTrigger(trigger)
      : null;
    if (avatarMatchedIdentifier) {
      this.log(
        `Resolved "${displayUsername}" from trigger avatar:`,
        avatarMatchedIdentifier
      );
      return avatarMatchedIdentifier;
    }

    if (this.isGenericUserCardLabel(displayUsername)) {
      this.log(`Skipping generic user-card label: "${displayUsername}"`);
      return null;
    }

    const normalized = this.normalizeUsername(displayUsername);
    if (!normalized) return null;

    return this.userIdentifierCache.get(normalized.toLowerCase()) || normalized.toLowerCase();
  }

  isGenericUserCardLabel(label) {
    if (typeof label !== 'string') return false;

    return /^(?:\d+\s+)?mutual friends?$/i.test(label.trim());
  }

  resolveUserIdentifierFromAnyTrigger(trigger) {
    const matches = [];

    for (const candidates of this.userIdentifierCandidates.values()) {
      const identifier = this.resolveUserIdentifierFromTrigger(
        candidates,
        trigger
      );
      if (identifier) matches.push(identifier);
    }

    const uniqueMatches = Array.from(
      new Map(matches.map((identifier) => [
        identifier.toLowerCase(),
        identifier
      ])).values()
    );

    return uniqueMatches.length === 1 ? uniqueMatches[0] : null;
  }

  resolveUserIdentifierFromTrigger(candidates, trigger) {
    if (!trigger) return null;

    const imageSources = Array.from(trigger.querySelectorAll('img'))
      .flatMap((image) => [
        image.currentSrc,
        image.getAttribute('src'),
        image.getAttribute('data-src')
      ])
      .filter(Boolean)
      .map((source) => source.toLowerCase());
    if (imageSources.length === 0) return null;

    const matches = Array.from(candidates.values()).filter((candidate) => {
      const identityParts = [
        candidate.discordId,
        candidate.discordAvatar,
        candidate.customAvatarUrl
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return identityParts.some((part) =>
        imageSources.some((source) => source.includes(part))
      );
    });

    return matches.length === 1 ? matches[0].identifier : null;
  }

  async cacheUserIdentifiersFromCurrentRoute() {
    const routeKey = `${window.location.pathname}${window.location.search}`;
    if (this.userIdentifierRouteKey === routeKey) return;

    if (this.userIdentifierRoutePromise?.routeKey === routeKey) {
      await this.userIdentifierRoutePromise.promise;
      return;
    }

    const dataPath = window.location.pathname.endsWith('/')
      ? `${window.location.pathname.slice(0, -1)}.data`
      : `${window.location.pathname}.data`;
    const dataUrl = `${dataPath || '/.data'}${window.location.search}`;

    const promise = (async () => {
      try {
        const response = await fetch(dataUrl);
        if (!response.ok) {
          throw new Error(`Route data request failed (${response.status})`);
        }
        this.cacheUserIdentifiersFromReactRouterData(await response.json());
      } catch (e) {
        this.log('Could not load user identifiers from current route:', e.message);
      } finally {
        this.userIdentifierRouteKey = routeKey;
      }
    })();

    this.userIdentifierRoutePromise = { routeKey, promise };
    await promise;
    if (this.userIdentifierRoutePromise?.promise === promise) {
      this.userIdentifierRoutePromise = null;
    }
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

    this.processUserCardTriggers();
  }

  async processUserCardTriggers() {
    const userCardTriggers = document.querySelectorAll(
      'button[data-rac][data-react-aria-pressable][aria-expanded]'
    );
    const candidates = [];

    userCardTriggers.forEach(trigger => {
      if (this.processedUserCardTriggers.has(trigger) ||
          trigger.closest('.match-history-wrapper') ||
          this.isInHeaderFooterOrNav(trigger)) {
        return;
      }

      const displayUsername = this.extractUsernameFromUserCardTrigger(trigger);
      if (displayUsername) {
        candidates.push({ trigger, displayUsername });
      }
    });

    if (candidates.length === 0) return;

    this.cacheUserIdentifiersFromReactRouterContext();
    if (candidates.some(({ displayUsername }) =>
      !this.userIdentifierCache.has(displayUsername.toLowerCase()))) {
      await this.cacheUserIdentifiersFromCurrentRoute();
    }

    for (const { trigger, displayUsername } of candidates) {
      if (this.processedUserCardTriggers.has(trigger) || !trigger.isConnected) {
        continue;
      }

      const username = this.getUserIdentifier(displayUsername, trigger);
      if (!username ||
          (this.loggedInUser &&
           (displayUsername.toLowerCase() === this.loggedInUser.toLowerCase() ||
            username.toLowerCase() === this.loggedInUser.toLowerCase()))) {
        continue;
      }

      this.addUserCardControls(trigger, username);
      this.processedUserCardTriggers.add(trigger);
    }
  }

  extractUsernameFromUserCardTrigger(trigger) {
    // Sendou user-card triggers include an avatar and visible username, while other
    // dialog triggers generally have only an icon, label, or tournament image.
    if (!trigger.querySelector('img')) return null;

    const textElements = trigger.querySelectorAll('span, strong, b');
    for (const element of textElements) {
      const directText = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .filter(Boolean)
        .join(' ')
        .trim();

      if (!directText ||
          directText.length > 50 ||
          /^(ign|fc|xp|tier)\s*:?\s*$/i.test(directText)) {
        continue;
      }

      const username = this.normalizeUsername(directText);
      if (username) return directText;
    }

    return null;
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
    wrapper.appendChild(this.createFeatureControls(username));

    // Wrap the user link and icons together to keep them inline
    const parent = userElement.parentElement;
    parent.replaceChild(wrapper, userElement);
  }

  addUserCardControls(trigger, username) {
    if (!this.showTournaments && !this.showWeapons) {
      return;
    }

    const controls = document.createElement('span');
    controls.className = 'match-history-user-card-controls';
    controls.appendChild(this.createFeatureControls(username, {
      fixedPopup: true,
      useButtonToggle: false
    }));

    const stopNativeUserCard = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    controls.addEventListener('pointerdown', stopNativeUserCard);
    controls.addEventListener('pointerup', stopNativeUserCard);
    controls.addEventListener('click', stopNativeUserCard);

    trigger.appendChild(controls);
  }

  createFeatureControls(username, options = {}) {
    const {
      fixedPopup = false,
      useButtonToggle = true
    } = options;
    const fragment = document.createDocumentFragment();

    // Create the shared tournaments expandable block (if enabled)
    if (this.showTournaments) {
      const tournamentsContainer = document.createElement('span');
      tournamentsContainer.className = 'match-history-container';

      const tournamentsToggle = document.createElement(useButtonToggle ? 'button' : 'span');
      tournamentsToggle.className = 'match-history-toggle';
      tournamentsToggle.textContent = '📊';
      tournamentsToggle.title = 'View tournament and opponent history';

      const tournamentsContent = document.createElement('div');
      tournamentsContent.className = 'match-history-content';
      tournamentsContent.style.display = 'none';

      const tournamentsLoadingText = document.createElement('div');
      tournamentsLoadingText.className = 'match-history-loading';
      tournamentsLoadingText.textContent = 'Loading match history...';
      tournamentsContent.appendChild(tournamentsLoadingText);

      tournamentsContainer.appendChild(tournamentsToggle);
      if (!fixedPopup) {
        tournamentsContainer.appendChild(tournamentsContent);
      }

      fragment.appendChild(tournamentsContainer);

      this.setupHoverPopup(tournamentsContainer, tournamentsToggle, tournamentsContent, async () => {
        await this.loadMatchHistory(username, tournamentsContent);
      }, { fixedPopup });
    }

    // Create the weapons expandable block (if enabled)
    if (this.showWeapons) {
      const weaponsContainer = document.createElement('span');
      weaponsContainer.className = 'match-history-container weapons-container';

      const weaponsToggle = document.createElement(useButtonToggle ? 'button' : 'span');
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
      if (!fixedPopup) {
        weaponsContainer.appendChild(weaponsContent);
      }

      fragment.appendChild(weaponsContainer);

      this.setupHoverPopup(weaponsContainer, weaponsToggle, weaponsContent, async () => {
        await this.loadWeapons(username, weaponsContent);
      }, { fixedPopup });
    }

    return fragment;
  }

  setupHoverPopup(triggerContainer, toggle, contentElement, loadContent, options = {}) {
    let loaded = false;
    let hideTimeout = null;
    let lastPointer = null;
    const hideDelayMs = 250;
    const fixedPopup = options.fixedPopup || this.isUserResultsPage();

    const rememberPointer = (event) => {
      lastPointer = {
        x: event.clientX,
        y: event.clientY
      };
    };

    const keepOpen = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };

    const hideNow = () => {
      keepOpen();
      contentElement.style.display = 'none';
      toggle.classList.remove('active');

      if (this.activePopup?.contentElement === contentElement) {
        this.activePopup = null;
      }
    };

    const hideSoon = (event) => {
      if (event) {
        rememberPointer(event);
      }
      keepOpen();
      hideTimeout = setTimeout(() => {
        if (this.pointIsInsideElement(triggerContainer, lastPointer) ||
            this.pointIsInsideElement(contentElement, lastPointer)) {
          return;
        }

        hideNow();
      }, hideDelayMs);
    };

    const show = async (event) => {
      rememberPointer(event);
      keepOpen();

      if (this.activePopup?.contentElement !== contentElement) {
        this.activePopup?.hideNow();
      }

      this.preparePopupPlacement(triggerContainer, contentElement, fixedPopup);
      contentElement.style.display = 'block';
      toggle.classList.add('active');
      this.activePopup = { contentElement, hideNow };

      this.positionPopup(triggerContainer, contentElement, fixedPopup);

      if (!loaded) {
        loaded = true;
        await loadContent();
        if (contentElement.style.display !== 'none') {
          this.positionPopup(triggerContainer, contentElement, fixedPopup);
        }
      }
    };

    triggerContainer.addEventListener('mouseenter', show);
    triggerContainer.addEventListener('mousemove', rememberPointer);
    triggerContainer.addEventListener('mouseleave', hideSoon);
    contentElement.addEventListener('mouseenter', (event) => {
      rememberPointer(event);
      keepOpen();
    });
    contentElement.addEventListener('mousemove', rememberPointer);
    contentElement.addEventListener('mouseleave', hideSoon);
    contentElement.addEventListener(
      'wheel',
      (event) => this.scrollPopupOnWheel(contentElement, event),
      { passive: false }
    );
  }

  scrollPopupOnWheel(contentElement, event) {
    event.preventDefault();
    event.stopPropagation();

    const maxScrollTop =
      contentElement.scrollHeight - contentElement.clientHeight;
    if (maxScrollTop <= 0 || event.deltaY === 0) return;

    const deltaMultiplier =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? contentElement.clientHeight
          : 1;
    const nextScrollTop =
      contentElement.scrollTop + event.deltaY * deltaMultiplier;

    contentElement.scrollTop = Math.max(
      0,
      Math.min(maxScrollTop, nextScrollTop)
    );
  }

  pointIsInsideElement(element, point) {
    if (!element || !point || element.style.display === 'none') {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return point.x >= rect.left &&
           point.x <= rect.right &&
           point.y >= rect.top &&
           point.y <= rect.bottom;
  }

  preparePopupPlacement(triggerContainer, contentElement, fixedPopup) {
    if (fixedPopup) {
      if (contentElement.parentElement !== document.body) {
        contentElement.classList.add('match-history-content--fixed');
        document.body.appendChild(contentElement);
      }
      contentElement.style.maxHeight = '';
      contentElement.style.overflowY = '';
      return;
    }

    if (contentElement.parentElement !== triggerContainer) {
      triggerContainer.appendChild(contentElement);
    }
    contentElement.classList.remove('match-history-content--fixed');
    contentElement.style.left = '';
    contentElement.style.top = '';
    contentElement.style.bottom = '';
    contentElement.style.maxHeight = '';
    contentElement.style.overflowY = '';
  }

  positionPopup(triggerContainer, contentElement, fixedPopup) {
    if (fixedPopup) {
      this.positionFixedPopup(triggerContainer, contentElement);
    } else {
      this.positionAnchoredPopup(triggerContainer, contentElement);
    }
  }

  getPopupVerticalPlacement(triggerRect, contentElement) {
    const margin = 12;
    const gap = 6;
    const availableBelow = window.innerHeight - triggerRect.bottom - gap - margin;
    const availableAbove = triggerRect.top - gap - margin;
    const naturalHeight = contentElement.scrollHeight;
    const openAbove =
      availableBelow < Math.min(naturalHeight, 280) &&
      availableAbove > availableBelow;

    return {
      gap,
      margin,
      openAbove,
      availableHeight: Math.max(
        80,
        Math.floor(openAbove ? availableAbove : availableBelow)
      )
    };
  }

  positionAnchoredPopup(triggerContainer, contentElement) {
    const triggerRect = triggerContainer.getBoundingClientRect();
    const placement = this.getPopupVerticalPlacement(
      triggerRect,
      contentElement
    );

    contentElement.style.maxHeight = `${placement.availableHeight}px`;
    contentElement.style.overflowY = 'auto';
    contentElement.style.top = placement.openAbove
      ? 'auto'
      : `calc(100% + ${placement.gap}px)`;
    contentElement.style.bottom = placement.openAbove
      ? `calc(100% + ${placement.gap}px)`
      : 'auto';
  }

  positionFixedPopup(triggerContainer, contentElement) {
    const triggerRect = triggerContainer.getBoundingClientRect();
    const placement = this.getPopupVerticalPlacement(
      triggerRect,
      contentElement
    );

    contentElement.style.maxHeight = `${placement.availableHeight}px`;
    contentElement.style.overflowY = 'auto';
    const popupRect = contentElement.getBoundingClientRect();
    let left = triggerRect.left + triggerRect.width / 2 - popupRect.width / 2;
    const top = placement.openAbove
      ? triggerRect.top - placement.gap - popupRect.height
      : triggerRect.bottom + placement.gap;

    left = Math.max(
      placement.margin,
      Math.min(
        left,
        window.innerWidth - popupRect.width - placement.margin
      )
    );

    contentElement.style.left = `${left}px`;
    contentElement.style.top = `${top}px`;
    contentElement.style.bottom = 'auto';
  }

  isUserResultsPage() {
    return /^\/u\/[^/]+\/results(?:\/|$)/.test(window.location.pathname);
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

      // Render matches with time range info
      this.renderMatches(
        result.matches,
        result.timeRangeMonths,
        contentElement,
        username,
        result.sendouQEncounters,
        result.sendouQAvailable,
        result.tournamentEncounters,
        result.encounterMonths,
        result.tournamentLoadFailed
      );
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
      const weapons = await this.fetchProfileWeapons(username);
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

  async fetchProfileWeapons(username) {
    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      throw new Error(`Invalid profile identifier: ${username}`);
    }

    const cacheKey = normalized.toLowerCase();
    if (this.profileWeaponsMemoryCache.has(cacheKey)) {
      return this.profileWeaponsMemoryCache.get(cacheKey);
    }

    const request = this.loadProfileWeapons(normalized, cacheKey);
    this.profileWeaponsMemoryCache.set(cacheKey, request);
    try {
      return await request;
    } catch (error) {
      this.profileWeaponsMemoryCache.delete(cacheKey);
      throw error;
    }
  }

  async loadProfileWeapons(username, cacheKey) {
    const cached = await this.getCachedProfileWeapons(cacheKey);
    if (cached !== null) {
      this.log(
        `Using cached profile weapons for ${username}: ${cached.length} weapons`
      );
      return cached;
    }

    const profileUrl =
      `https://sendou.ink/u/${encodeURIComponent(username)}`;
    this.log(`Fetching profile page: ${profileUrl}`);
    const response = await fetch(profileUrl);
    if (!response.ok) {
      throw new Error(`Failed to load profile page (${response.status})`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const weapons = this.extractWeaponsFromProfile(doc);
    await this.cacheProfileWeapons(cacheKey, weapons);
    return weapons;
  }

  async getCachedProfileWeapons(cacheKey) {
    try {
      const stored = await chrome.storage.local.get(
        this.profileWeaponsCacheStorageKey
      );
      const cache = stored[this.profileWeaponsCacheStorageKey] || {};
      const entry = cache[cacheKey];
      if (
        !entry ||
        !Array.isArray(entry.weapons) ||
        Date.now() - entry.cachedAt >= this.profileWeaponsCacheTtlMs
      ) {
        return null;
      }
      return entry.weapons;
    } catch (error) {
      this.error('Could not read the profile weapons cache:', error);
      return null;
    }
  }

  async cacheProfileWeapons(cacheKey, weapons) {
    this.profileWeaponsCacheWriteQueue =
      this.profileWeaponsCacheWriteQueue
        .catch((error) => {
          this.error('Previous profile weapons cache write failed:', error);
        })
        .then(async () => {
          const stored = await chrome.storage.local.get(
            this.profileWeaponsCacheStorageKey
          );
          const existing =
            stored[this.profileWeaponsCacheStorageKey] || {};
          const now = Date.now();
          const cache = Object.fromEntries(
            Object.entries(existing).filter(
              ([, entry]) =>
                entry &&
                now - entry.cachedAt < this.profileWeaponsCacheTtlMs
            )
          );
          cache[cacheKey] = { cachedAt: now, weapons };
          await chrome.storage.local.set({
            [this.profileWeaponsCacheStorageKey]: cache
          });
        });

    try {
      await this.profileWeaponsCacheWriteQueue;
    } catch (error) {
      this.error('Could not cache profile weapons:', error);
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

      const timeRangeMonths = this.tournamentLookbackMonths;
      this.log(`Using tournament lookback: ${timeRangeMonths} months`);

      // Find common tournaments (pass username for teammate detection)
      const commonTournaments = this.findCommonTournaments(loggedInResults, otherUserResults, username);

      this.log(`Found ${commonTournaments.length} shared tourneys`);

      const encounterMonths = timeRangeMonths;
      const encounterResult = await this.fetchRecentOpponentEncounters(
        username,
        commonTournaments,
        encounterMonths
      );

      // Return all common tournaments with time range info
      return {
        matches: commonTournaments,
        totalCommon: commonTournaments.length,
        timeRangeMonths: timeRangeMonths,
        sendouQEncounters: encounterResult.sendouQEncounters,
        sendouQAvailable: encounterResult.sendouQAvailable,
        tournamentEncounters: encounterResult.tournamentEncounters,
        encounterMonths,
        tournamentLoadFailed: encounterResult.tournamentLoadFailed
      };
    } catch (error) {
      this.error('API Error:', error);
      throw error;
    }
  }

  toTimestampSeconds(value) {
    if (typeof value === 'number') {
      return value > 1000000000000 ? Math.floor(value / 1000) : value;
    }
    if (typeof value === 'string') {
      const parsed = Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
      return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
    }
    return 0;
  }

  async fetchSeasonHistoryPage(identifier, season, page) {
    const cacheKey = `${identifier}:${season ?? 'latest'}:${page}`;
    if (this.seasonHistoryCache.has(cacheKey)) {
      return this.seasonHistoryCache.get(cacheKey);
    }

    const request = (async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (season != null) params.set('season', String(season));

      const response = await fetch(
        `https://sendou.ink/u/${encodeURIComponent(identifier)}/seasons.data?${params}`
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch SendouQ history (${response.status} ${response.statusText})`
        );
      }

      const data = await response.json();
      const parent = this.findDecodedRouteData(
        data,
        'features/user-page/routes/u.$identifier.seasons'
      );
      const sets = this.findDecodedRouteData(
        data,
        'features/user-page/routes/u.$identifier.seasons.index'
      );
      if (parent?.error || sets?.error) {
        throw new Error('SendouQ history requires an active sendou.ink login');
      }
      return { parent, sets };
    })();

    this.seasonHistoryCache.set(cacheKey, request);
    try {
      return await request;
    } catch (error) {
      this.seasonHistoryCache.delete(cacheKey);
      throw error;
    }
  }

  async fetchRecentSeasonHistory(viewer, months) {
    const cacheKey = `${viewer.id}:${months}`;
    if (this.recentSeasonHistoryCache.has(cacheKey)) {
      return this.recentSeasonHistoryCache.get(cacheKey);
    }

    const request = (async () => {
      const identifier = this.getIdentityRoute(viewer);
      const firstPage = await this.fetchSeasonHistoryPage(identifier, null, 1);
      const seasons = [
        ...(firstPage.parent?.seasonsParticipatedIn || [])
      ]
        .sort((a, b) => b - a)
        .slice(0, this.maxSendouQSeasons);
      const cutoff = Math.floor(
        Date.now() / 1000 - months * 30.44 * 24 * 60 * 60
      );
      const results = [];
      let truncated = false;

      for (const season of seasons) {
        let pageData =
          season === firstPage.sets?.season
            ? firstPage
            : await this.fetchSeasonHistoryPage(identifier, season, 1);
        const totalPages = pageData.sets?.results?.pagesCount || 1;
        const pagesCount = Math.min(totalPages, this.maxSeasonPages);
        let reachedCutoff = false;

        for (let page = 1; page <= pagesCount; page++) {
          if (page > 1) {
            pageData = await this.fetchSeasonHistoryPage(identifier, season, page);
          }
          const pageResults = pageData.sets?.results?.value || [];
          results.push(...pageResults);
          const timestamps = pageResults
            .map((result) => this.toTimestampSeconds(result.createdAt))
            .filter(Boolean);
          if (timestamps.length > 0 && Math.min(...timestamps) < cutoff) {
            reachedCutoff = true;
            break;
          }
        }

        if (totalPages > pagesCount && !reachedCutoff) {
          truncated = true;
          break;
        }

        const seasonTimestamps = results
          .map((result) => this.toTimestampSeconds(result.createdAt))
          .filter(Boolean);
        if (
          seasonTimestamps.length > 0 &&
          Math.min(...seasonTimestamps) < cutoff
        ) {
          break;
        }
      }

      return {
        results: results.filter(
          (result) => this.toTimestampSeconds(result.createdAt) >= cutoff
        ),
        truncated
      };
    })();

    this.recentSeasonHistoryCache.set(cacheKey, request);
    try {
      return await request;
    } catch (error) {
      this.recentSeasonHistoryCache.delete(cacheKey);
      throw error;
    }
  }

  async fetchSendouQOpponentEncounters(viewer, target, months) {
    const history = await this.fetchRecentSeasonHistory(viewer, months);
    const encounters = [];

    for (const result of history.results) {
      if (result.type !== 'GROUP_MATCH' || !result.groupMatch) continue;

      const match = result.groupMatch;
      const alphaIds = (match.groupAlphaMembers || []).map((user) => Number(user.id));
      const bravoIds = (match.groupBravoMembers || []).map((user) => Number(user.id));
      const viewerIsAlpha = alphaIds.includes(viewer.id);
      const viewerIsBravo = bravoIds.includes(viewer.id);
      const targetIsAlpha = alphaIds.includes(target.id);
      const targetIsBravo = bravoIds.includes(target.id);

      if (!((viewerIsAlpha && targetIsBravo) || (viewerIsBravo && targetIsAlpha))) {
        continue;
      }

      const score = match.score || [];
      const yourScore = viewerIsAlpha ? score[0] : score[1];
      const theirScore = viewerIsAlpha ? score[1] : score[0];
      encounters.push({
        id: match.id,
        source: 'SendouQ',
        name: `SendouQ match #${match.id}`,
        timestamp: this.toTimestampSeconds(result.createdAt),
        yourScore,
        theirScore,
        url: `https://sendou.ink/q/match/${match.id}`
      });
    }

    return { encounters, loadFailed: history.truncated };
  }

  async fetchTournamentBracket(tournamentId) {
    if (this.tournamentBracketCache.has(tournamentId)) {
      return this.tournamentBracketCache.get(tournamentId);
    }

    const request = (async () => {
      const response = await fetch(
        `https://sendou.ink/to/${tournamentId}/brackets.data`
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch tournament ${tournamentId} bracket (${response.status})`
        );
      }
      const data = await response.json();
      const serialized = data.find(
        (item) =>
          typeof item === 'string' &&
          item.startsWith('{"tournament":')
      );
      if (!serialized) {
        throw new Error(`Tournament ${tournamentId} bracket data was not found`);
      }
      return JSON.parse(serialized).tournament;
    })();

    this.tournamentBracketCache.set(tournamentId, request);
    try {
      return await request;
    } catch (error) {
      this.tournamentBracketCache.delete(tournamentId);
      throw error;
    }
  }

  async fetchTournamentOpponentEncounters(sharedTournaments, months) {
    const cutoff = Math.floor(
      Date.now() / 1000 - months * 30.44 * 24 * 60 * 60
    );
    const opponents = sharedTournaments.filter(
      (tournament) =>
        tournament.yourTeamId &&
        tournament.theirTeamId &&
        tournament.yourTeamId !== tournament.theirTeamId &&
        this.toTimestampSeconds(tournament.date) >= cutoff
    );

    const bracketResults = await Promise.allSettled(
      opponents.map(async (tournament) => {
        const bracket = await this.fetchTournamentBracket(tournament.tournamentId);
        return (bracket?.data?.match || [])
          .filter((match) => {
            const teamIds = [match.opponent1?.id, match.opponent2?.id];
            return (
              match.startedAt &&
              Number.isFinite(match.opponent1?.score) &&
              Number.isFinite(match.opponent2?.score) &&
              teamIds.includes(tournament.yourTeamId) &&
              teamIds.includes(tournament.theirTeamId)
            );
          })
          .map((match) => {
            const youAreOpponentOne =
              match.opponent1.id === tournament.yourTeamId;
            return {
              id: match.id,
              tournamentId: tournament.tournamentId,
              source: 'Tournament',
              name: `Set #${match.id}`,
              timestamp: match.startedAt || this.toTimestampSeconds(tournament.date),
              yourScore: youAreOpponentOne
                ? match.opponent1.score
                : match.opponent2.score,
              theirScore: youAreOpponentOne
                ? match.opponent2.score
                : match.opponent1.score,
              url: `https://sendou.ink/to/${tournament.tournamentId}/matches/${match.id}`
            };
          });
      })
    );

    const encounters = [];
    let loadFailed = false;
    bracketResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        encounters.push(...result.value);
      } else {
        loadFailed = true;
        this.error('Could not load a shared tournament bracket:', result.reason);
      }
    });
    return { encounters, loadFailed };
  }

  async fetchRecentOpponentEncounters(username, sharedTournaments, months) {
    const sendouQRequest = Promise.all([
      this.fetchUserIdentity(this.loggedInUser),
      this.fetchUserIdentity(username)
    ]).then(([viewer, target]) =>
      this.fetchSendouQOpponentEncounters(viewer, target, months)
    );
    const [sendouQResult, tournamentResult] = await Promise.allSettled([
      sendouQRequest,
      this.fetchTournamentOpponentEncounters(sharedTournaments, months)
    ]);

    let sendouQEncounters = [];
    const sendouQAvailable = sendouQResult.status === 'fulfilled';
    if (sendouQAvailable) {
      sendouQEncounters = sendouQResult.value.encounters;
    } else {
      this.error('Could not load SendouQ opponent encounters:', sendouQResult.reason);
    }

    let tournamentEncounters = [];
    let tournamentLoadFailed = false;
    if (tournamentResult.status === 'fulfilled') {
      tournamentEncounters = tournamentResult.value.encounters;
      tournamentLoadFailed = tournamentResult.value.loadFailed;
    } else {
      tournamentLoadFailed = true;
      this.error(
        'Could not load tournament opponent encounters:',
        tournamentResult.reason
      );
    }

    return {
      sendouQEncounters: sendouQEncounters
        .filter((encounter) => encounter.timestamp)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxEncounters),
      sendouQAvailable,
      tournamentEncounters: tournamentEncounters
        .filter((encounter) => encounter.timestamp)
        .sort((a, b) => b.timestamp - a.timestamp),
      tournamentLoadFailed
    };
  }

  async fetchUserResults(username) {
    this.log(`Fetching results for: ${username}`);

    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      this.error(`Invalid username for tournament results: ${username}`);
      return null;
    }
    const cacheKey = normalized.toLowerCase();
    if (this.tournamentResultsMemoryCache.has(cacheKey)) {
      return this.tournamentResultsMemoryCache.get(cacheKey);
    }

    const request = this.loadUserResults(normalized, cacheKey);
    this.tournamentResultsMemoryCache.set(cacheKey, request);

    try {
      return await request;
    } catch (error) {
      this.tournamentResultsMemoryCache.delete(cacheKey);
      this.error(`Error fetching results for ${username}:`, error);
      this.error(`Error details:`, error.message);
      return null;
    }
  }

  async loadUserResults(username, cacheKey) {
    const cached = await this.getCachedTournamentResults(cacheKey);
    if (cached) {
      this.log(
        `Using cached six-month tournament history for ${username}: ${cached.length} results`
      );
      return cached;
    }

    const cutoff = Math.floor(
      Date.now() / 1000 -
        this.tournamentLookbackMonths * 30.44 * 24 * 60 * 60
    );
    const seenTournamentIds = new Set();
    const results = [];
    let page = 1;
    let pagesCount = 1;
    let pagesFetched = 0;

    do {
      const pageData = await this.fetchUserResultsPage(username, page);
      pagesFetched++;
      pagesCount = pageData.pagesCount;

      for (const result of pageData.results) {
        const startTime = this.toTimestampSeconds(result.startTime);
        if (
          startTime >= cutoff &&
          !seenTournamentIds.has(result.tournamentId)
        ) {
          seenTournamentIds.add(result.tournamentId);
          results.push({ ...result, startTime });
        }
      }

      const timestamps = pageData.results
        .map((result) => this.toTimestampSeconds(result.startTime))
        .filter(Boolean);
      if (
        pageData.results.length === 0 ||
        (timestamps.length > 0 && Math.min(...timestamps) < cutoff)
      ) {
        break;
      }
      page++;
    } while (page <= pagesCount);

    results.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    await this.cacheTournamentResults(cacheKey, results);
    this.log(
      `Loaded ${results.length} tournaments for ${username} across ${pagesFetched} page(s)`
    );
    return results;
  }

  async fetchUserResultsPage(username, page) {
    const params = new URLSearchParams({
      all: 'true',
      page: String(page)
    });
    const url =
      `https://sendou.ink/u/${encodeURIComponent(username)}/results.data?${params}`;
    this.log(`Fetching from: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        this.error(`User ${username} might not exist or has no results page`);
      }
      throw new Error(
        `Failed to fetch results for ${username} (${response.status})`
      );
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Invalid tournament data returned for ${username}`);
    }

    const routeData = this.findDecodedRouteData(
      data,
      'features/user-page/routes/u.$identifier.results'
    );
    const results = this.parseResults(data);
    return {
      results,
      pagesCount: Math.max(1, Number(routeData?.results?.pagesCount) || 1)
    };
  }

  async getCachedTournamentResults(cacheKey) {
    try {
      const stored = await chrome.storage.local.get(
        this.tournamentResultsCacheStorageKey
      );
      const cache =
        stored[this.tournamentResultsCacheStorageKey] || {};
      const entry = cache[cacheKey];
      if (
        !entry ||
        !Array.isArray(entry.results) ||
        Date.now() - entry.cachedAt >= this.tournamentResultsCacheTtlMs
      ) {
        return null;
      }

      const cutoff = Math.floor(
        Date.now() / 1000 -
          this.tournamentLookbackMonths * 30.44 * 24 * 60 * 60
      );
      return entry.results.filter(
        (result) => this.toTimestampSeconds(result.startTime) >= cutoff
      );
    } catch (error) {
      this.error('Could not read the tournament results cache:', error);
      return null;
    }
  }

  async cacheTournamentResults(cacheKey, results) {
    this.tournamentResultsCacheWriteQueue =
      this.tournamentResultsCacheWriteQueue
        .catch((error) => {
          this.error('Previous tournament cache write failed:', error);
        })
        .then(async () => {
          const stored = await chrome.storage.local.get(
            this.tournamentResultsCacheStorageKey
          );
          const existing =
            stored[this.tournamentResultsCacheStorageKey] || {};
          const now = Date.now();
          const cache = Object.fromEntries(
            Object.entries(existing).filter(
              ([, entry]) =>
                entry &&
                now - entry.cachedAt < this.tournamentResultsCacheTtlMs
            )
          );
          cache[cacheKey] = { cachedAt: now, results };
          await chrome.storage.local.set({
            [this.tournamentResultsCacheStorageKey]: cache
          });
        });

    try {
      await this.tournamentResultsCacheWriteQueue;
    } catch (error) {
      this.error('Could not cache tournament results:', error);
    }
  }

  parseResults(data) {
    // Parse the Remix-style encoded response
    // The format uses numeric references to look up values in the main data array
    // IMPORTANT: Handle both highlighted and non-highlighted tournaments
    try {
      const routeData = this.findDecodedRouteData(
        data,
        'features/user-page/routes/u.$identifier.results'
      );
      const decodedResults = routeData?.results?.value;
      if (Array.isArray(decodedResults)) {
        const seenDecodedIds = new Set();
        return decodedResults
          .filter((result) => {
            if (!result?.tournamentId || seenDecodedIds.has(result.tournamentId)) {
              return false;
            }
            seenDecodedIds.add(result.tournamentId);
            return true;
          })
          .map((result) => {
            result.mates?.forEach((mate) => this.cacheUserIdentity(mate));
            return {
              tournamentId: result.tournamentId,
              eventName: result.eventName || null,
              startTime: result.startsAt || null,
              placement: result.placement || null,
              logoUrl: result.logoUrl || null,
              division: result.div?.name || result.div || null,
              teammates: (result.mates || []).flatMap((mate) =>
                [mate.username, mate.customUrl, mate.discordId]
                  .filter(Boolean)
                  .map((value) => value.toLowerCase())
              ),
              teamCount: result.participantCount || null,
              teamId: result.teamId || null
            };
          });
      }

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
        const wereTeammates =
          (tournament1.teamId &&
            tournament2.teamId &&
            tournament1.teamId === tournament2.teamId) ||
          (tournament1.teammates &&
            tournament1.teammates.length > 0 &&
            tournament1.teammates.some(
              (mate) => mate.toLowerCase() === otherUsernameLower
            ));

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
          wereTeammates: wereTeammates,
          theirTeamId: tournament2.teamId
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
      wereTeammates: t.wereTeammates,
      yourTeamId: t.teamId,
      theirTeamId: t.theirTeamId
    }));
  }

  renderMatches(
    matches,
    timeRangeMonths,
    contentElement,
    username,
    sendouQEncounters = [],
    sendouQAvailable = true,
    tournamentEncounters = [],
    encounterMonths = this.encounterMonths,
    tournamentLoadFailed = false
  ) {
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

    const tournamentEncountersById = new Map();
    tournamentEncounters.forEach((encounter) => {
      const tournamentSets =
        tournamentEncountersById.get(encounter.tournamentId) || [];
      tournamentSets.push(encounter);
      tournamentEncountersById.set(encounter.tournamentId, tournamentSets);
    });

    const tournamentsHTML = matches.length > 0
      ? matches.map(match => {
          const wereTeammates = match.wereTeammates;
          let placementHTML = '';
          if (wereTeammates) {
            const division = match.yourDivision || match.theirDivision;
            placementHTML = `<span class="placement-badge placement-teammates">❤️ Teammates: #${match.yourPlacement}${division ? ` (${this.escapeHtml(String(division))})` : ''}</span>`;
          } else {
            placementHTML = `
              ${match.yourPlacement ? `<span class="placement-badge placement-you">You: #${match.yourPlacement}${match.yourDivision ? ` (${this.escapeHtml(String(match.yourDivision))})` : ''}</span>` : ''}
              ${match.theirPlacement ? `<span class="placement-badge placement-them">Them: #${match.theirPlacement}${match.theirDivision ? ` (${this.escapeHtml(String(match.theirDivision))})` : ''}</span>` : ''}
            `;
          }

          const teamCountText = match.teamCount ? ` (${match.teamCount} teams)` : '';
          const tournamentSets = tournamentEncountersById.get(
            match.tournamentId
          ) || [];
          const tournamentSetsHTML = tournamentSets.length > 0
            ? `
              <div class="tournament-set-list">
                ${tournamentSets
                  .map((encounter) =>
                    this.renderOpponentEncounter(encounter, { compact: true })
                  )
                  .join('')}
              </div>
            `
            : '';
          return `
            <div class="match-history-item">
              <a href="${match.url || '#'}" target="_blank" class="match-history-link">
                <div class="match-tournament-name">
                  ${this.escapeHtml(match.tournamentName || 'Unknown Tournament')}${teamCountText}
                </div>
                <div class="match-placements">${placementHTML}</div>
                ${match.date ? `<div class="match-date">${this.formatDate(match.date)}</div>` : ''}
              </a>
              ${tournamentSetsHTML}
            </div>
          `;
        }).join('')
      : `<div class="match-history-empty">No shared tourneys found between you and ${this.escapeHtml(username)}</div>`;

    const encounterMonthText = encounterMonths === 1 ? 'month' : 'months';
    const sendouQEncountersHTML = sendouQEncounters
      .map((encounter) => this.renderOpponentEncounter(encounter))
      .join('');
    const sendouQSectionHTML =
      sendouQAvailable && sendouQEncounters.length > 0
      ? `
        <div class="match-history-header opponent-history-header">
          Recent opponent matches
          <span class="opponent-history-subtitle">SendouQ · Last ${encounterMonths} ${encounterMonthText}; teammate matches excluded</span>
        </div>
        ${sendouQEncountersHTML}
      `
      : '';
    const tournamentWarningHTML = tournamentLoadFailed
      ? '<div class="opponent-encounter-warning">Some tournament set history could not be loaded</div>'
      : '';

    const html = `
      <div class="match-history-list">
        ${lutiBannerHTML}
        <div class="match-history-header">${headerText}</div>
        ${tournamentsHTML}
        ${tournamentWarningHTML}
        ${sendouQSectionHTML}
      </div>
    `;

    contentElement.innerHTML = html;
  }

  renderOpponentEncounter(encounter, options = {}) {
    const hasScore =
      Number.isFinite(encounter.yourScore) &&
      Number.isFinite(encounter.theirScore);
    const result =
      !hasScore || encounter.yourScore === encounter.theirScore
        ? ''
        : encounter.yourScore > encounter.theirScore
          ? 'Win'
          : 'Loss';
    const compactClass = options.compact ? ' tournament-set-encounter' : '';

    return `
      <div class="opponent-encounter${compactClass}">
        <a href="${encounter.url}" target="_blank" class="match-history-link">
          <div class="opponent-encounter-title">
            ${options.compact ? '' : `<span class="opponent-encounter-source">${this.escapeHtml(encounter.source)}</span>`}
            <span>${this.escapeHtml(encounter.name)}</span>
          </div>
          <div class="opponent-encounter-details">
            ${hasScore ? `<span class="opponent-encounter-score">You ${encounter.yourScore}-${encounter.theirScore} Them</span>` : ''}
            ${result ? `<span class="opponent-encounter-result opponent-encounter-result--${result.toLowerCase()}">${result}</span>` : ''}
          </div>
          ${options.compact ? '' : `<div class="match-date">${this.formatDate(new Date(encounter.timestamp * 1000).toISOString())}</div>`}
        </a>
      </div>
    `;
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
