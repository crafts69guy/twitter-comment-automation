import { chromium } from 'playwright';
import fs from 'fs';

class PlaywrightService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.currentPage = null;
    this.isProcessing = false;
    this.shouldPause = false;
    this.shouldStop = false;
    this.extractedCredentials = null; // Store extracted credentials temporarily
    this.cachedCredentials = null; // Cache credentials to avoid re-extraction
    this.lastExtractionTime = null; // Track when credentials were last extracted
  }

  async getBrowserStatus() {
    let isActuallyOpen = false;
    let isLoggedIn = false;

    if (this.browser) {
      try {
        const isConnected = this.browser.isConnected();
        isActuallyOpen = isConnected;

        if (!isConnected) {
          this.browser = null;
          this.context = null;
          this.currentPage = null;
        } else if (this.currentPage) {
          // Check if logged in by checking session health
          try {
            const sessionCheck = await this.checkSessionHealth(this.currentPage);
            isLoggedIn = sessionCheck.valid;
          } catch (error) {
            console.error('Error checking login status:', error);
            isLoggedIn = false;
          }
        }
      } catch (error) {
        this.browser = null;
        this.context = null;
        this.currentPage = null;
        isActuallyOpen = false;
      }
    }

    return {
      isOpen: isActuallyOpen,
      isLoggedIn: isLoggedIn,
      currentUrl: this.currentPage ? await this.getCurrentUrl() : null,
    };
  }

  async getCurrentUrl() {
    if (!this.currentPage) return null;
    try {
      return this.currentPage.url();
    } catch {
      return null;
    }
  }

  async ensureBrowserOpen(credentials = null) {
    if (!this.browser || !this.browser.isConnected()) {
      await this.initialize(credentials);
    }
    return this.currentPage;
  }

  async initialize(credentials = null) {
    if (this.browser && this.browser.isConnected()) {
      console.log('Browser already open');
      return;
    }

    const launchOptions = {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    // Check if running in Docker (Alpine Linux with Chromium)
    if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
      console.log('Using Docker Chromium from env:', process.env.PLAYWRIGHT_EXECUTABLE_PATH);
      launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
    } else {
      // Auto-detect Chrome/Chromium path based on platform
      const platform = process.platform;
      const possiblePaths = this.getChromePaths(platform);

      for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
          console.log(`Found Chrome at: ${chromePath}`);
          launchOptions.executablePath = chromePath;
          break;
        }
      }

      if (!launchOptions.executablePath) {
        console.log('Using default Playwright Chromium');
      }
    }

    console.log('Launching browser with Playwright...');
    this.browser = await chromium.launch(launchOptions);

    // Create browser context with realistic settings
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    this.currentPage = await this.context.newPage();

    console.log('Browser initialized with Playwright', JSON.stringify(credentials));

    // Auto-login if credentials provided
    if (credentials && credentials.username && credentials.password) {
      console.log('Credentials provided, attempting auto-login...');
      const extractedCredentials = await this.loginToTwitter(
        credentials.username,
        credentials.password,
        credentials.verificationHandle,
      );

      // Store extracted credentials temporarily so they can be retrieved
      if (extractedCredentials) {
        this.extractedCredentials = extractedCredentials;
      }
    }
  }

  /**
   * Random delay between min and max milliseconds
   */
  async randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await this.currentPage.waitForTimeout(delay);
  }

  /**
   * Generate Gaussian random number (normal distribution)
   * More realistic than uniform random for human behavior
   */
  gaussianRandom(mean, stdDev) {
    let u1 = 0,
      u2 = 0;
    while (u1 === 0) u1 = Math.random(); // Converting [0,1) to (0,1)
    while (u2 === 0) u2 = Math.random();

    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.max(0, z0 * stdDev + mean); // Ensure non-negative
  }

  /**
   * Get typing delay based on character type
   * Different character types have different typing speeds
   */
  getCharacterTypingDelay(char, previousChar) {
    const baseDelay = 80; // Base delay in ms

    // Letter characters: fastest
    if (/[a-zA-Z]/.test(char)) {
      return this.gaussianRandom(baseDelay, 20);
    }

    // Numbers: slightly slower
    if (/[0-9]/.test(char)) {
      return this.gaussianRandom(baseDelay + 30, 25);
    }

    // Space after punctuation: longer pause (thinking)
    if (char === ' ' && /[.,!?;:]/.test(previousChar)) {
      return this.gaussianRandom(baseDelay + 150, 50);
    }

    // Regular space: normal
    if (char === ' ') {
      return this.gaussianRandom(baseDelay + 20, 15);
    }

    // Punctuation: slower (need to think)
    if (/[.,!?;:]/.test(char)) {
      return this.gaussianRandom(baseDelay + 80, 30);
    }

    // Special characters: slowest
    if (/[^\w\s]/.test(char)) {
      return this.gaussianRandom(baseDelay + 100, 40);
    }

    // Default
    return this.gaussianRandom(baseDelay, 20);
  }

  /**
   * Get nearby key on QWERTY keyboard for realistic typo simulation
   */
  getNearbyKey(char) {
    const keyboardMap = {
      q: ['w', 'a', 's'],
      w: ['q', 'e', 's', 'd'],
      e: ['w', 'r', 'd', 'f'],
      r: ['e', 't', 'f', 'g'],
      t: ['r', 'y', 'g', 'h'],
      y: ['t', 'u', 'h', 'j'],
      u: ['y', 'i', 'j', 'k'],
      i: ['u', 'o', 'k', 'l'],
      o: ['i', 'p', 'l'],
      p: ['o', 'l'],
      a: ['q', 's', 'z'],
      s: ['a', 'w', 'd', 'z', 'x'],
      d: ['s', 'e', 'f', 'x', 'c'],
      f: ['d', 'r', 'g', 'c', 'v'],
      g: ['f', 't', 'h', 'v', 'b'],
      h: ['g', 'y', 'j', 'b', 'n'],
      j: ['h', 'u', 'k', 'n', 'm'],
      k: ['j', 'i', 'l', 'm'],
      l: ['k', 'o', 'p'],
      z: ['a', 's', 'x'],
      x: ['z', 's', 'd', 'c'],
      c: ['x', 'd', 'f', 'v'],
      v: ['c', 'f', 'g', 'b'],
      b: ['v', 'g', 'h', 'n'],
      n: ['b', 'h', 'j', 'm'],
      m: ['n', 'j', 'k'],
    };

    const lowerChar = char.toLowerCase();
    const nearbyKeys = keyboardMap[lowerChar];

    if (!nearbyKeys || nearbyKeys.length === 0) {
      // Fallback to random letter
      return String.fromCharCode(97 + Math.floor(Math.random() * 26));
    }

    const randomNearby = nearbyKeys[Math.floor(Math.random() * nearbyKeys.length)];

    // Preserve case
    return char === char.toUpperCase() ? randomNearby.toUpperCase() : randomNearby;
  }

  /**
   * Randomly move mouse slightly during typing (simulating hand movement)
   */
  async randomMouseWiggle() {
    try {
      const currentPos = await this.currentPage.evaluate(() => ({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }));

      // Small random movement (5-30 pixels)
      const deltaX = (Math.random() - 0.5) * 60;
      const deltaY = (Math.random() - 0.5) * 60;

      await this.currentPage.mouse.move(currentPos.x + deltaX, currentPos.y + deltaY, { steps: 3 });
    } catch (error) {
      // Ignore mouse movement errors
    }
  }

  /**
   * Move mouse to element with human-like curve movement
   */
  async moveMouseToElement(element) {
    try {
      const box = await element.boundingBox();
      if (!box) return;

      // Random point within element bounds
      const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
      const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

      // Move mouse with smooth steps
      await this.currentPage.mouse.move(targetX, targetY, {
        steps: Math.floor(Math.random() * 10) + 5, // 5-15 steps
      });

      await this.randomDelay(50, 150);
    } catch (error) {
      // Ignore mouse movement errors
      console.log('Mouse movement skipped:', error.message);
    }
  }

  /**
   * Type text in a human-like manner with advanced realistic patterns
   * Features:
   * - Burst typing (fast bursts followed by pauses)
   * - Character-type-aware delays (punctuation slower than letters)
   * - Realistic typos based on keyboard proximity
   * - Random mouse movements during typing
   * - Gaussian distribution for delays (more natural)
   * - Reading pauses (simulating re-reading what was typed)
   */
  async typeHumanLike(element, text) {
    let i = 0;
    let previousChar = '';

    while (i < text.length) {
      // === BURST TYPING PATTERN ===
      // Humans type in bursts of 3-7 characters, then pause to think
      const burstLength = Math.floor(this.gaussianRandom(5, 2)); // Average 5 chars per burst
      const burstEnd = Math.min(i + burstLength, text.length);

      // Type burst of characters
      for (let j = i; j < burstEnd; j++) {
        const char = text[j];

        // === REALISTIC TYPO SIMULATION (CHECK FIRST) ===
        // Higher typo chance at:
        // - End of bursts (typing fast)
        // - After spaces (starting new word)
        // - Only for letters (we don't typo punctuation as much)
        const isEndOfBurst = j === burstEnd - 1;
        const afterSpace = previousChar === ' ';
        const isLetter = /[a-zA-Z]/.test(char);

        let typoChance = 0.08; // Base 8% chance (increased from 3% for more realistic typos)
        if (isEndOfBurst) typoChance += 0.04; // Higher at end of bursts
        if (afterSpace) typoChance += 0.03; // Higher after spaces

        const shouldTypo = Math.random() < typoChance && isLetter && j < text.length - 1;

        if (shouldTypo) {
          // Get nearby key for realistic typo
          const wrongChar = this.getNearbyKey(char);
          console.log(`💡 Typo simulation: typing "${wrongChar}" instead of "${char}"`);

          // Type wrong character FIRST
          await element.pressSequentially(wrongChar, { delay: this.gaussianRandom(80, 20) });

          // Pause when noticing typo (human reaction time)
          await this.currentPage.waitForTimeout(this.gaussianRandom(300, 100));

          // Delete wrong character
          await element.press('Backspace');
          await this.currentPage.waitForTimeout(this.gaussianRandom(150, 50));

          // Now type the CORRECT character (slower, more careful)
          await element.pressSequentially(char, { delay: this.gaussianRandom(150, 40) });
          console.log(`✅ Typo corrected: "${char}"`);
        } else {
          // No typo - type character normally
          const charDelay = this.getCharacterTypingDelay(char, previousChar);
          await element.pressSequentially(char, { delay: charDelay });
        }

        previousChar = char;

        // === RANDOM MOUSE WIGGLE ===
        // 5% chance to move mouse slightly during typing (natural hand movement)
        if (Math.random() < 0.05) {
          await this.randomMouseWiggle();
        }
      }

      i = burstEnd;

      // === THINKING PAUSE BETWEEN BURSTS ===
      if (i < text.length) {
        // Longer pause at sentence boundaries
        const justTypedPunctuation = /[.!?]/.test(previousChar);
        const pauseDuration = justTypedPunctuation
          ? this.gaussianRandom(800, 200) // Longer pause after sentences
          : this.gaussianRandom(400, 150); // Regular thinking pause

        await this.currentPage.waitForTimeout(pauseDuration);

        // === READING PAUSE ===
        // 15% chance to pause and "re-read" what was typed
        // More likely after punctuation
        const readingPauseChance = justTypedPunctuation ? 0.25 : 0.15;
        if (Math.random() < readingPauseChance) {
          // Simulate reading by pausing longer
          await this.currentPage.waitForTimeout(this.gaussianRandom(1000, 300));

          // Small mouse movement (looking at text)
          await this.randomMouseWiggle();
        }
      }
    }

    // Final pause after finishing typing (reviewing before submit)
    await this.currentPage.waitForTimeout(this.gaussianRandom(800, 250));
  }

  /**
   * Auto-login to Twitter/X with username and password
   * Returns extracted Bearer Token and Cookies after successful login
   */
  async loginToTwitter(username, password, verificationHandle = null) {
    try {
      console.log('Navigating to Twitter login page...');
      await this.currentPage.goto('https://twitter.com/i/flow/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for page to load and settle
      await this.currentPage.waitForTimeout(3000);

      // Step 1: Enter username/email
      console.log('Entering username...');
      const usernameInput = this.currentPage.locator('input[autocomplete="username"]');
      await usernameInput.waitFor({ timeout: 10000 });

      // Move mouse to input field and click (human-like)
      await this.moveMouseToElement(usernameInput);
      await usernameInput.click();
      await this.randomDelay(300, 700);

      // Type username with random delays like a human
      await this.typeHumanLike(usernameInput, username);
      await this.randomDelay(500, 1500);

      // Click "Next" button
      const nextButton = this.currentPage.locator('button:has-text("Next")').first();
      await this.moveMouseToElement(nextButton);
      await this.randomDelay(200, 500);
      await nextButton.click();
      console.log('Clicked Next button');

      await this.currentPage.waitForTimeout(3000);

      // Check for unusual activity challenge (phone/username verification)
      const unusualActivityInput = this.currentPage.locator('input[name="text"]');
      const hasUnusualActivity = (await unusualActivityInput.count()) > 0;

      if (hasUnusualActivity) {
        if (!verificationHandle || verificationHandle.trim() === '') {
          throw new Error(
            '❌ Twitter detected unusual activity and requires verification. ' +
              'Please configure "Phone Number or Username (for verification)" in Settings.',
          );
        }
        console.log('⚠️  Detected unusual activity challenge - entering verification handle...');
        await this.moveMouseToElement(unusualActivityInput);
        await unusualActivityInput.click();
        await this.randomDelay(300, 700);
        await this.typeHumanLike(unusualActivityInput, verificationHandle);
        await this.randomDelay(800, 1500);

        // Click Next button after entering verification username
        const verifyNextButton = this.currentPage.locator('button:has-text("Next")').first();
        await this.moveMouseToElement(verifyNextButton);
        await this.randomDelay(200, 500);
        await verifyNextButton.click();
        console.log('Clicked Next button after verification');

        await this.randomDelay(2000, 4000);
      }

      // Step 2: Enter password
      console.log('Entering password...');
      const passwordInput = this.currentPage.locator('input[name="password"]');
      await passwordInput.waitFor({ timeout: 10000 });

      // Move mouse and click password field to focus
      await this.moveMouseToElement(passwordInput);
      await passwordInput.click();
      await this.randomDelay(300, 700);

      // Type password with human-like behavior
      await this.typeHumanLike(passwordInput, password);
      await this.randomDelay(500, 1200);

      // Click "Log in" button
      const loginButton = this.currentPage.locator('button[data-testid="LoginForm_Login_Button"]');
      await this.moveMouseToElement(loginButton);
      await this.randomDelay(300, 600);
      await loginButton.click();
      console.log('Clicked Login button');

      // Wait for navigation to home page
      await this.currentPage.waitForURL('**/home', { timeout: 15000 });
      console.log('✅ Successfully logged in to Twitter');

      await this.currentPage.waitForTimeout(3000);

      // Extract Bearer Token and Cookies after successful login
      console.log('📦 Extracting Bearer Token and Cookies...');
      const credentials = await this.extractCredentialsFromBrowser();

      if (credentials.bearerToken && credentials.cookies) {
        console.log('✅ Successfully extracted credentials from browser');
        return credentials;
      } else {
        console.warn('⚠️  Could not extract all credentials, will use existing ones');
        return null;
      }
    } catch (error) {
      console.error('❌ Error during Twitter login:', error.message);
      throw new Error(`Twitter login failed: ${error.message}`);
    }
  }

  /**
   * Check if Twitter session is still valid
   * Returns { valid: boolean, reason: string }
   */
  async checkSessionHealth(page) {
    try {
      const url = page.url();

      // Check if redirected to login page
      if (url.includes('/i/flow/login') || url.includes('/login')) {
        console.warn('⚠️ Session expired - detected login page redirect');
        return { valid: false, reason: 'redirected_to_login' };
      }

      // Check for "Rate limit" or "Unauthorized" messages
      const errorMessages = await page
        .locator('text=/unauthorized|rate limit|session expired/i')
        .count();
      if (errorMessages > 0) {
        console.warn('⚠️ Session expired - error message detected');
        return { valid: false, reason: 'error_message_detected' };
      }

      return { valid: true };
    } catch (error) {
      console.error('⚠️ Error checking session health:', error.message);
      return { valid: false, reason: error.message };
    }
  }

  /**
   * Extract Bearer Token and Cookies from browser after login
   */
  async extractCredentialsFromBrowser(forceRefresh = false) {
    try {
      // Check cache (valid for 1 hour)
      const cacheValidityMs = 60 * 60 * 1000; // 1 hour
      const isCacheValid =
        this.cachedCredentials &&
        this.lastExtractionTime &&
        Date.now() - this.lastExtractionTime < cacheValidityMs;

      if (!forceRefresh && isCacheValid) {
        console.log('✅ Using cached credentials (extracted less than 1 hour ago)');
        return this.cachedCredentials;
      }

      console.log('🔄 Extracting fresh credentials from browser...');

      // Get cookies from browser context
      const cookies = await this.context.cookies();

      // Extract important cookies
      const cookieObj = {};
      cookies.forEach(cookie => {
        if (['auth_token', 'ct0', 'twid', 'guest_id'].includes(cookie.name)) {
          cookieObj[cookie.name] = cookie.value;
        }
      });

      console.log('🍪 Extracted cookies:', Object.keys(cookieObj));

      // Extract Bearer Token from network requests
      let bearerToken = null;
      let requestListener = null;

      // Listen to network requests to capture Authorization header
      const bearerTokenPromise = new Promise(resolve => {
        const timeout = setTimeout(() => {
          if (requestListener) {
            this.currentPage.off('request', requestListener);
          }
          resolve(null);
        }, 10000); // Increase timeout to 10s

        requestListener = request => {
          const headers = request.headers();
          if (headers['authorization'] && headers['authorization'].startsWith('Bearer ')) {
            clearTimeout(timeout);
            this.currentPage.off('request', requestListener);
            console.log('✅ Bearer Token captured from network request');
            resolve(headers['authorization']);
          }
        };

        this.currentPage.on('request', requestListener);
      });

      // Navigate to trigger API calls
      console.log('🔄 Navigating to Twitter home to capture Bearer Token...');
      await this.currentPage.goto('https://twitter.com/home', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait a bit for page to load and make API calls
      await this.currentPage.waitForTimeout(2000);

      // Scroll to trigger more API calls
      await this.currentPage.evaluate(() => {
        window.scrollBy(0, 500);
      });

      await this.currentPage.waitForTimeout(1000);

      bearerToken = await bearerTokenPromise;

      if (!bearerToken) {
        console.log('⚠️  Bearer Token not found in network requests, trying fallback methods...');

        // Fallback 1: Extract from page source (main.js files)
        bearerToken = await this.currentPage.evaluate(() => {
          try {
            // Look for Bearer token in script tags
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
              const content = script.textContent || '';
              const match = content.match(/Bearer [A-Za-z0-9\-._~+/]+=*/);
              if (match) {
                return match[0];
              }
            }

            // Check localStorage
            const localStorageToken = localStorage.getItem('twitter_bearer_token');
            if (localStorageToken) return localStorageToken;

            // Check window object
            if (window.__INITIAL_STATE__?.token) return window.__INITIAL_STATE__.token;

            return null;
          } catch (e) {
            return null;
          }
        });

        if (bearerToken) {
          console.log('✅ Bearer Token found via fallback method');
        }
      }

      if (!bearerToken) {
        console.warn(
          '⚠️  Could not extract Bearer Token. Twitter API calls may fail. Please check browser session.',
        );
      }

      console.log('🔑 Bearer Token found:', bearerToken ? 'Yes' : 'No');
      if (bearerToken) {
        console.log('📏 Bearer Token length:', bearerToken.length);
      }

      const credentials = {
        bearerToken: bearerToken || '',
        cookies: JSON.stringify(cookieObj),
      };

      // Cache credentials
      this.cachedCredentials = credentials;
      this.lastExtractionTime = Date.now();
      console.log('💾 Credentials cached for 1 hour');

      return credentials;
    } catch (error) {
      console.error('❌ Error extracting credentials:', error.message);
      return {
        bearerToken: '',
        cookies: '',
      };
    }
  }

  getChromePaths(platform) {
    const paths = {
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ],
      linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
      ],
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ],
    };

    return paths[platform] || [];
  }

  /**
   * Process batch sequentially with single tab
   * @param {Array} links - Array of link objects { id, url, comment, content }
   * @param {Object} credentials - Twitter credentials { username, password }
   * @param {Function} onProgress - Callback for progress updates
   * @param {Function} onLinkComplete - Callback when each link completes
   * @param {Function} onCredentialsExtracted - Callback when credentials are extracted from browser
   * @returns {Object} - { completed: bool, stopped: bool, results: array, processedCount: number }
   */
  async processBatchSequential(
    links,
    credentials,
    onProgress,
    onLinkComplete,
    onCredentialsExtracted,
  ) {
    const page = await this.ensureBrowserOpen(credentials);

    // Check if credentials were extracted during login
    if (this.extractedCredentials && onCredentialsExtracted) {
      console.log('📤 Sending extracted credentials to controller...');
      onCredentialsExtracted(this.extractedCredentials);
      this.extractedCredentials = null; // Clear after sending
    }

    const results = [];
    this.isProcessing = true;
    this.shouldStop = false;

    console.log(`Starting sequential batch processing for ${links.length} links`);

    for (let i = 0; i < links.length; i++) {
      // Check stop flag
      if (this.shouldStop) {
        console.log('Batch processing stopped by user');
        this.isProcessing = false;
        return { stopped: true, results, processedCount: i };
      }

      // Handle pause
      while (this.shouldPause && !this.shouldStop) {
        console.log('Processing paused, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const link = links[i];
      console.log(`Processing link ${i + 1}/${links.length}: ${link.url}`);

      // ✅ CHECK SESSION HEALTH BEFORE PROCESSING EACH LINK
      const sessionCheck = await this.checkSessionHealth(page);
      if (!sessionCheck.valid) {
        console.error(`❌ Session expired: ${sessionCheck.reason}`);
        console.log('🔄 Attempting to re-login...');

        try {
          // RE-LOGIN
          const newCredentials = await this.loginToTwitter(
            credentials.username,
            credentials.password,
            credentials.verificationHandle,
          );

          // Send new credentials to controller
          if (newCredentials && onCredentialsExtracted) {
            console.log('📤 Sending refreshed credentials to controller...');
            onCredentialsExtracted(newCredentials);
          }

          // VERIFY LOGIN SUCCESS
          const recheckSession = await this.checkSessionHealth(page);
          if (!recheckSession.valid) {
            throw new Error('Re-login failed - session still invalid');
          }

          console.log('✅ Re-login successful, continuing batch processing...');
        } catch (reloginError) {
          console.error('❌ Re-login failed:', reloginError.message);
          // Stop batch processing if re-login fails
          this.isProcessing = false;
          return {
            stopped: true,
            results,
            processedCount: i,
            error: 'Session expired and re-login failed',
          };
        }
      }

      // Progress callback
      if (onProgress) {
        onProgress({
          currentIndex: i,
          total: links.length,
          currentLink: link,
          percentage: Math.round(((i + 1) / links.length) * 100),
        });
      }

      try {
        // Navigate to link with Playwright's more reliable wait
        await page.goto(link.url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });

        console.log(`Navigated to: ${link.url}`);

        // Check stop flag after navigation
        if (this.shouldStop) {
          console.log('Batch processing stopped by user after navigation');
          this.isProcessing = false;
          return { stopped: true, results, processedCount: i };
        }

        // Wait for page to settle and load dynamic content
        await page.waitForTimeout(5000);

        // Check stop flag after page load wait
        if (this.shouldStop) {
          console.log('Batch processing stopped by user after page load');
          this.isProcessing = false;
          return { stopped: true, results, processedCount: i };
        }

        // Auto-reply workflow: Like + Comment
        await this.autoReplyOnPage(page, link.comment);

        const result = {
          linkId: link.id,
          status: 'success',
          processedAt: new Date(),
        };

        results.push(result);
        console.log(`✅ Link ${i + 1} processed successfully`);

        // Callback for completed link
        if (onLinkComplete) {
          onLinkComplete(result);
        }

        // Check stop flag immediately after completing link (before delays)
        if (this.shouldStop) {
          console.log('Batch processing stopped by user after completing link');
          this.isProcessing = false;
          return { stopped: true, results, processedCount: i + 1 };
        }

        // Human behavior: After posting a reply, users typically:
        // 1. Check if the reply posted correctly
        // 2. See if anyone liked/replied immediately
        // 3. Maybe scroll to read other comments
        // 4. Wait before moving to next tweet
        // This makes the behavior more natural and avoids rate limiting
        if (i < links.length - 1) {
          console.log('Post-reply activity (checking reply, reading comments)...');
          await this.randomDelay(5000, 10000); // 5-10s post-reply activity

          // Check stop flag after first delay
          if (this.shouldStop) {
            console.log('Batch processing stopped by user during post-reply activity');
            this.isProcessing = false;
            return { stopped: true, results, processedCount: i + 1 };
          }

          console.log('Waiting before navigating to next tweet...');
          await this.randomDelay(3000, 6000); // 3-6s transition delay

          // Check stop flag after second delay
          if (this.shouldStop) {
            console.log('Batch processing stopped by user during transition delay');
            this.isProcessing = false;
            return { stopped: true, results, processedCount: i + 1 };
          }

          // Total delay between tweets: 8-16 seconds (much more realistic)
        }
      } catch (error) {
        console.error(`❌ Error processing link ${i + 1}:`, error.message);

        const result = {
          linkId: link.id,
          status: 'failed',
          error: error.message,
          processedAt: new Date(),
        };

        results.push(result);

        // Callback for failed link
        if (onLinkComplete) {
          onLinkComplete(result);
        }

        // Check stop flag after failed link
        if (this.shouldStop) {
          console.log('Batch processing stopped by user after link failure');
          this.isProcessing = false;
          return { stopped: true, results, processedCount: i + 1 };
        }

        // Even on error, add a delay before next tweet
        if (i < links.length - 1) {
          console.log('Error occurred, waiting before next tweet...');
          await this.randomDelay(3000, 6000);

          // Check stop flag after error delay
          if (this.shouldStop) {
            console.log('Batch processing stopped by user during error delay');
            this.isProcessing = false;
            return { stopped: true, results, processedCount: i + 1 };
          }
        }
      }
    }

    this.isProcessing = false;
    console.log(`Batch processing completed: ${results.length} links processed`);

    return {
      completed: true,
      stopped: false,
      results,
      processedCount: links.length,
    };
  }

  /**
   * Like and reply on current page
   * @param {Page} page - Playwright page object
   * @param {String} comment - Comment text to post
   */
  async autoReplyOnPage(page, comment) {
    console.log('Starting auto-reply workflow...');

    // Check stop flag before starting
    if (this.shouldStop) {
      throw new Error('Auto-reply stopped by user before starting');
    }

    // Step 1: Like the post
    await this.likePost(page);

    // Check stop flag after liking
    if (this.shouldStop) {
      throw new Error('Auto-reply stopped by user after liking');
    }

    // Human behavior: After liking, users typically:
    // 1. Watch the like animation (already handled in likePost)
    // 2. Re-read the tweet to think about the reply
    // 3. Decide what to comment
    // This delay simulates "thinking time" between like and reply
    console.log('Thinking about reply...');
    await this.randomDelay(2000, 4500);

    // Check stop flag after thinking delay
    if (this.shouldStop) {
      throw new Error('Auto-reply stopped by user during thinking time');
    }

    // Step 2: Reply to the post
    await this.replyToPost(page, comment);

    console.log('Auto-reply workflow completed');
  }

  /**
   * Like a post
   */
  async likePost(page) {
    try {
      console.log('Attempting to like post...');

      // Check stop flag before starting
      if (this.shouldStop) {
        throw new Error('Like stopped by user');
      }

      // Pre-delay before liking
      await page.waitForTimeout(2500);

      // Check stop flag after pre-delay
      if (this.shouldStop) {
        throw new Error('Like stopped by user after pre-delay');
      }

      // Wait for first cell container
      await page.waitForSelector('[data-testid="cellInnerDiv"]', {
        timeout: 10000,
      });

      // Check if already liked
      const isLiked = (await page.locator('[data-testid="unlike"]').count()) > 0;

      if (isLiked) {
        console.log('Post already liked, skipping...');
        return;
      }

      // Find and click like button using Playwright's auto-wait
      const likeButton = page.locator('[data-testid="like"]').first();

      if ((await likeButton.count()) > 0) {
        await this.moveMouseToElement(likeButton);
        await this.randomDelay(300, 800);

        // Check stop flag before clicking
        if (this.shouldStop) {
          throw new Error('Like stopped by user before clicking');
        }

        await likeButton.click();
        console.log('✅ Post liked');

        // Post-like delay
        await this.randomDelay(3000, 6000);

        // Check stop flag after post-like delay
        if (this.shouldStop) {
          throw new Error('Like stopped by user after post-like delay');
        }
      } else {
        console.log('Like button not found');
      }
    } catch (error) {
      console.error('Error liking post:', error.message);
      // Re-throw if it's a stop error
      if (error.message.includes('stopped by user')) {
        throw error;
      }
      // Continue even if like fails for other reasons
    }
  }

  /**
   * Reply to a post
   */
  async replyToPost(page, comment) {
    try {
      console.log('Attempting to reply to post (inline mode)...');

      // Check stop flag before starting
      if (this.shouldStop) {
        throw new Error('Reply stopped by user before starting');
      }

      // Human behavior: Scroll with smooth, variable amount (not fixed 100px)
      await this.randomDelay(500, 1000);

      // Check stop flag after first delay
      if (this.shouldStop) {
        throw new Error('Reply stopped by user before scrolling');
      }

      const scrollAmount = Math.floor(this.gaussianRandom(120, 40)); // Average 120px, varies
      await page.evaluate(amount => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, scrollAmount);
      await this.randomDelay(800, 1500); // Wait for smooth scroll to complete

      // Check stop flag after scrolling
      if (this.shouldStop) {
        throw new Error('Reply stopped by user after scrolling');
      }

      // Look for inline reply textarea directly (without clicking reply button)
      // Based on Twitter's DOM structure, the textarea is already rendered inline
      let textarea = null;

      // Multiple selector strategies (LANGUAGE-INDEPENDENT)
      // These selectors work regardless of browser language (EN, VI, JP, etc.)
      // IMPORTANT: Avoid aria-label and other text-based attributes that can be translated
      const textareaSelectors = [
        // Strategy 1: Most reliable - data-testid + contenteditable + role
        // Does NOT use aria-label (which gets translated to "Đăng văn bản" in Vietnamese)
        '[data-testid="tweetTextarea_0"][contenteditable="true"][role="textbox"]',

        // Strategy 2: DraftEditor class + data-testid (very specific)
        '.public-DraftEditor-content[contenteditable="true"][data-testid="tweetTextarea_0"]',

        // Strategy 3: notranslate class + data-testid (Twitter marks this as non-translatable)
        '.notranslate.public-DraftEditor-content[contenteditable="true"][data-testid="tweetTextarea_0"]',

        // Strategy 4: Generic DraftEditor with role (no data-testid needed)
        '.public-DraftEditor-content[contenteditable="true"][role="textbox"]',

        // Strategy 5: notranslate + contenteditable + role
        '.notranslate[contenteditable="true"][role="textbox"]',

        // Strategy 6: Most generic - any contenteditable textbox with multiline (last resort)
        'div[contenteditable="true"][role="textbox"][aria-multiline="true"]',
      ];

      console.log('Looking for inline reply textarea...');

      for (const selector of textareaSelectors) {
        try {
          const element = page.locator(selector).first();
          await element.waitFor({ timeout: 3000, state: 'visible' });

          // Double check element is actually visible and interactable
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();

          if (isVisible && isEnabled) {
            textarea = element;
            console.log(`✓ Found inline reply textarea with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
          console.log(`  ✗ Selector failed: ${selector}`);
          continue;
        }
      }

      // If no textarea found, throw error with helpful message
      if (!textarea) {
        console.log('❌ No inline textarea found after trying all selectors.');
        throw new Error(
          'Could not find inline reply textarea. Make sure you are on the tweet detail page.',
        );
      }

      // Human behavior: Pause before clicking textarea (reading/preparing to type)
      // Users don't immediately click the reply box - they think about what to say
      console.log('Preparing to type reply...');
      await this.randomDelay(1000, 2500);

      // Check stop flag before clicking textarea
      if (this.shouldStop) {
        throw new Error('Reply stopped by user before clicking textarea');
      }

      // Click directly on the textarea to focus it
      await this.moveMouseToElement(textarea);
      await this.randomDelay(300, 700);
      await textarea.click();
      await this.randomDelay(800, 1500);
      console.log('Focused on inline reply textarea');

      // Check stop flag before typing
      if (this.shouldStop) {
        throw new Error('Reply stopped by user before typing');
      }

      // Type comment with human-like behavior
      console.log(`Typing comment: "${comment}"`);
      await this.typeHumanLike(textarea, comment);

      console.log('Comment typed successfully');

      // Check stop flag after typing
      if (this.shouldStop) {
        throw new Error('Reply stopped by user after typing');
      }

      // Wait before submitting (human-like pause to review)
      await this.randomDelay(2000, 4000);

      // Check stop flag before submitting
      if (this.shouldStop) {
        throw new Error('Reply stopped by user before submitting');
      }

      // Find and click submit button
      const submitButton = await this.waitForEnabledSubmitButton(page);

      if (submitButton) {
        await this.moveMouseToElement(submitButton);
        await this.randomDelay(400, 900);

        // Check stop flag before clicking submit
        if (this.shouldStop) {
          throw new Error('Reply stopped by user before clicking submit');
        }

        await submitButton.click();
        console.log('✅ Reply submitted');

        // Final delay to ensure reply is posted
        await this.randomDelay(2500, 4000);

        // Check stop flag after submission
        if (this.shouldStop) {
          throw new Error('Reply stopped by user after submission');
        }

        // Human behavior: After submitting, users typically check their reply
        // Scroll down a bit to see the posted reply
        console.log('Checking posted reply...');
        const checkScrollAmount = Math.floor(this.gaussianRandom(80, 30));
        await page.evaluate(amount => {
          window.scrollBy({ top: amount, behavior: 'smooth' });
        }, checkScrollAmount);

        // Wait and "read" the posted reply
        await this.randomDelay(1500, 3000);

        // Check stop flag after checking reply
        if (this.shouldStop) {
          throw new Error('Reply stopped by user after checking reply');
        }
      } else {
        throw new Error('Submit button not found or not enabled');
      }
    } catch (error) {
      console.error('Error replying to post:', error.message);
      throw error;
    }
  }

  /**
   * Wait for submit button to be enabled
   */
  async waitForEnabledSubmitButton(page, maxWaitTime = 15000) {
    try {
      const submitButton = page.locator('button[data-testid="tweetButtonInline"]');

      // Wait for button to be visible and enabled
      await submitButton.waitFor({
        state: 'visible',
        timeout: maxWaitTime,
      });

      // Wait for button to be enabled (not disabled)
      await page.waitForFunction(
        selector => {
          const btn = document.querySelector(selector);
          return btn && !btn.disabled;
        },
        'button[data-testid="tweetButtonInline"]',
        { timeout: maxWaitTime },
      );

      console.log('Submit button is enabled');
      return submitButton;
    } catch (error) {
      console.error('Submit button did not become enabled within timeout');
      return null;
    }
  }

  /**
   * Set pause state
   */
  setPause(shouldPause) {
    this.shouldPause = shouldPause;
    console.log(`Pause state set to: ${shouldPause}`);
  }

  /**
   * Set stop state
   */
  setStop(shouldStop) {
    this.shouldStop = shouldStop;
    console.log(`Stop state set to: ${shouldStop}`);
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.context) {
      console.log('Closing browser context...');
      await this.context.close();
      this.context = null;
      this.currentPage = null;
    }

    if (this.browser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }

  /**
   * Scrape tweet (legacy method for compatibility)
   */
  async scrapeTweet(url, credentials = null) {
    const page = await this.ensureBrowserOpen(credentials);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);

      const tweetData = await page.evaluate(() => {
        const selectors = {
          text: '[data-testid="tweetText"]',
          userName: '[data-testid="User-Name"]',
          like: '[data-testid="like"]',
          retweet: '[data-testid="retweet"]',
          reply: '[data-testid="reply"]',
        };

        const getText = () => {
          const textElement = document.querySelector(selectors.text);
          if (textElement) return textElement.innerText;

          const spans = document.querySelectorAll('[data-testid="tweetText"] span');
          if (spans.length > 0) {
            return Array.from(spans)
              .map(span => span.innerText)
              .join(' ');
          }

          return null;
        };

        const text = getText();

        const userElement = document.querySelector(selectors.userName);
        const userName = userElement ? userElement.innerText.split('\n')[0] : null;

        const getMetric = selector => {
          const element = document.querySelector(selector);
          if (!element) return 0;
          const ariaLabel = element.getAttribute('aria-label');
          if (!ariaLabel) return 0;
          const match = ariaLabel.match(/(\d+(?:,\d+)*)/);
          return match ? parseInt(match[1].replace(/,/g, '')) : 0;
        };

        return {
          text,
          author: userName,
          likes: getMetric(selectors.like),
          retweets: getMetric(selectors.retweet),
          replies: getMetric(selectors.reply),
        };
      });

      return {
        success: true,
        url,
        ...tweetData,
      };
    } catch (error) {
      console.error('Error scraping tweet:', error.message);
      return {
        success: false,
        url,
        error: error.message,
      };
    }
  }
}

// Singleton instance
const playwrightService = new PlaywrightService();
export default playwrightService;
