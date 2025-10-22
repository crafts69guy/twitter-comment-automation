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
  }

  async getBrowserStatus() {
    let isActuallyOpen = false;
    if (this.browser) {
      try {
        const isConnected = this.browser.isConnected();
        isActuallyOpen = isConnected;

        if (!isConnected) {
          this.browser = null;
          this.context = null;
          this.currentPage = null;
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
      currentUrl: this.currentPage ? await this.getCurrentUrl() : null
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

  async ensureBrowserOpen() {
    if (!this.browser || !this.browser.isConnected()) {
      await this.initialize();
    }
    return this.currentPage;
  }

  async initialize() {
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
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    this.currentPage = await this.context.newPage();

    console.log('Browser initialized with Playwright');
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
   * @param {Function} onProgress - Callback for progress updates
   * @param {Function} onLinkComplete - Callback when each link completes
   * @returns {Object} - { completed: bool, stopped: bool, results: array, processedCount: number }
   */
  async processBatchSequential(links, onProgress, onLinkComplete) {
    const page = await this.ensureBrowserOpen();
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

      // Progress callback
      if (onProgress) {
        onProgress({
          currentIndex: i,
          total: links.length,
          currentLink: link,
          percentage: Math.round(((i + 1) / links.length) * 100)
        });
      }

      try {
        // Navigate to link with Playwright's more reliable wait
        await page.goto(link.url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        console.log(`Navigated to: ${link.url}`);

        // Wait for page to settle
        await page.waitForTimeout(3000);

        // Auto-reply workflow: Like + Comment
        await this.autoReplyOnPage(page, link.comment);

        const result = {
          linkId: link.id,
          status: 'success',
          processedAt: new Date()
        };

        results.push(result);
        console.log(`✅ Link ${i + 1} processed successfully`);

        // Callback for completed link
        if (onLinkComplete) {
          onLinkComplete(result);
        }

      } catch (error) {
        console.error(`❌ Error processing link ${i + 1}:`, error.message);

        const result = {
          linkId: link.id,
          status: 'failed',
          error: error.message,
          processedAt: new Date()
        };

        results.push(result);

        // Callback for failed link
        if (onLinkComplete) {
          onLinkComplete(result);
        }
      }

      // Delay between links to avoid rate limiting
      if (i < links.length - 1) {
        console.log('Waiting 2 seconds before next link...');
        await page.waitForTimeout(2000);
      }
    }

    this.isProcessing = false;
    console.log(`Batch processing completed: ${results.length} links processed`);

    return {
      completed: true,
      stopped: false,
      results,
      processedCount: links.length
    };
  }

  /**
   * Like and reply on current page
   * @param {Page} page - Playwright page object
   * @param {String} comment - Comment text to post
   */
  async autoReplyOnPage(page, comment) {
    console.log('Starting auto-reply workflow...');

    // Step 1: Like the post
    await this.likePost(page);

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

      // Pre-delay before liking
      await page.waitForTimeout(2500);

      // Wait for first cell container
      await page.waitForSelector('[data-testid="cellInnerDiv"]', {
        timeout: 10000
      });

      // Check if already liked
      const isLiked = await page.locator('[data-testid="unlike"]').count() > 0;

      if (isLiked) {
        console.log('Post already liked, skipping...');
        return;
      }

      // Find and click like button using Playwright's auto-wait
      const likeButton = page.locator('[data-testid="like"]').first();
      
      if (await likeButton.count() > 0) {
        await likeButton.click();
        console.log('✅ Post liked');

        // Post-like delay
        await page.waitForTimeout(5000);
      } else {
        console.log('Like button not found');
      }

    } catch (error) {
      console.error('Error liking post:', error.message);
      // Continue even if like fails
    }
  }

  /**
   * Reply to a post
   */
  async replyToPost(page, comment) {
    try {
      console.log('Attempting to reply to post...');

      // Click reply button to open reply textarea
      const replyButton = page.locator('[data-testid="reply"]').first();
      await replyButton.click();
      console.log('Clicked reply button');

      // Wait for reply textarea to appear
      const textarea = page.locator('[data-testid="tweetTextarea_0"][role="textbox"]');
      await textarea.waitFor({ timeout: 10000 });
      console.log('Reply textarea found');

      // Click textarea to focus
      await textarea.click();
      await page.waitForTimeout(1000);

      // Type comment with natural timing using Playwright's type
      console.log(`Typing comment: "${comment}"`);
      await textarea.type(comment, { delay: 30 });

      console.log('Comment typed successfully');

      // Wait before submitting
      await page.waitForTimeout(3000);

      // Find and click submit button
      const submitButton = await this.waitForEnabledSubmitButton(page);

      if (submitButton) {
        await submitButton.click();
        console.log('✅ Reply submitted');

        // Final delay to ensure reply is posted
        await page.waitForTimeout(3000);
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
        timeout: maxWaitTime 
      });
      
      // Wait for button to be enabled (not disabled)
      await page.waitForFunction(
        (selector) => {
          const btn = document.querySelector(selector);
          return btn && !btn.disabled;
        },
        'button[data-testid="tweetButtonInline"]',
        { timeout: maxWaitTime }
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
  async scrapeTweet(url) {
    const page = await this.ensureBrowserOpen();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(8000);

      const tweetData = await page.evaluate(() => {
        const selectors = {
          text: '[data-testid="tweetText"]',
          userName: '[data-testid="User-Name"]',
          like: '[data-testid="like"]',
          retweet: '[data-testid="retweet"]',
          reply: '[data-testid="reply"]'
        };

        const getText = () => {
          const textElement = document.querySelector(selectors.text);
          if (textElement) return textElement.innerText;

          const spans = document.querySelectorAll('[data-testid="tweetText"] span');
          if (spans.length > 0) {
            return Array.from(spans).map(span => span.innerText).join(' ');
          }

          return null;
        };

        const text = getText();

        const userElement = document.querySelector(selectors.userName);
        const userName = userElement ? userElement.innerText.split('\n')[0] : null;

        const getMetric = (selector) => {
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
          replies: getMetric(selectors.reply)
        };
      });

      return {
        success: true,
        url,
        ...tweetData
      };

    } catch (error) {
      console.error('Error scraping tweet:', error.message);
      return {
        success: false,
        url,
        error: error.message
      };
    }
  }
}

// Singleton instance
const playwrightService = new PlaywrightService();
export default playwrightService;
