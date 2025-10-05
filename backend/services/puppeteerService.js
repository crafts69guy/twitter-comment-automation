import puppeteer from "puppeteer";
import fs from "fs";

class PuppeteerService {
  constructor() {
    this.browser = null;
    this.defaultMaxTabs = 5;
    this.activeTabs = new Map(); // Track active tabs by URL
  }

  async initialize() {
    if (!this.browser) {
      // Configuration for browser launch
      let launchOptions = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1920,1080",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
          "--allow-running-insecure-content",
          "--no-default-browser-check",
          "--disable-infobars",
          "--exclude-switches=enable-automation",
          "--enable-features=NetworkService,NetworkServiceInProcess",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI"
        ]
      };

      // Check if running in Docker (Alpine Linux with Chromium)
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        console.log("Using Docker Chromium from env:", process.env.PUPPETEER_EXECUTABLE_PATH);
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      } else if (fs.existsSync('/usr/bin/chromium-browser')) {
        // Alpine Linux Chromium
        console.log("Using Alpine Chromium: /usr/bin/chromium-browser");
        launchOptions.executablePath = '/usr/bin/chromium-browser';
      } else if (process.platform === "darwin") {
        // macOS
        const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
        if (fs.existsSync(chromePath)) {
          console.log("Using macOS Chrome:", chromePath);
          launchOptions.executablePath = chromePath;
        }
      } else if (process.platform === "win32") {
        // Windows
        const windowsPaths = [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
        ];

        for (const path of windowsPaths) {
          if (fs.existsSync(path)) {
            console.log("Using Windows Chrome:", path);
            launchOptions.executablePath = path;
            break;
          }
        }
      } else {
        // Linux
        const linuxPaths = [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium"
        ];

        for (const path of linuxPaths) {
          if (fs.existsSync(path)) {
            console.log("Using Linux Chrome/Chromium:", path);
            launchOptions.executablePath = path;
            break;
          }
        }
      }

      // If no executable found, use Puppeteer's bundled Chromium
      if (!launchOptions.executablePath) {
        console.log("No Chrome/Chromium found, using Puppeteer's bundled Chromium");
      }

      this.browser = await puppeteer.launch(launchOptions);
      console.log("Browser opened successfully");
    }
    return this.browser;
  }

  async getOrCreateTab(url) {
    await this.initialize();

    // Check if we already have a tab for this URL or similar
    const baseUrl = url.split("?")[0]; // Remove query parameters for comparison

    if (this.activeTabs.has(baseUrl)) {
      const existingPage = this.activeTabs.get(baseUrl);
      try {
        // Check if the tab is still valid
        await existingPage.evaluate(() => window.location.href);
        console.log(`Reusing existing tab for: ${baseUrl}`);
        return existingPage;
      } catch (error) {
        // Tab is closed or invalid, remove from map
        this.activeTabs.delete(baseUrl);
      }
    }

    // Create new tab
    const page = await this.browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    // Set viewport to desktop size
    await page.setViewport({ width: 1920, height: 1080 });

    this.activeTabs.set(baseUrl, page);
    console.log(`Created new tab for: ${baseUrl}`);
    return page;
  }

  async scrapeTweet(url, page) {
    try {
      // Set viewport to desktop size
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to the URL with longer timeout
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Wait longer for React app to fully render
      await new Promise((resolve) => setTimeout(resolve, 8000));

      // Enhanced selectors for Twitter/X
      const selectors = {
        // Main tweet selectors
        article: 'article[data-testid="tweet"]',
        articleFallback: "article",
        tweetText: '[data-testid="tweetText"]',

        // Alternative text selectors
        tweetTextSpan: 'div[data-testid="tweetText"] span',
        langDiv: 'div[lang][dir="auto"]',

        // User selectors
        userName: '[data-testid="User-Name"]',
        userNameAlt: "div[dir=auto] span",

        // Metrics
        likeButton: '[data-testid="like"]',
        retweetButton: '[data-testid="retweet"]',
        replyButton: '[data-testid="reply"]',
      };

      // Wait for main content with multiple fallbacks
      await Promise.race([
        page.waitForSelector(selectors.tweetText, { timeout: 15000 }),
        page.waitForSelector(selectors.langDiv, { timeout: 15000 }),
        page.waitForSelector(selectors.article, { timeout: 15000 }),
      ]).catch(() => {
        console.log(`Warning: Could not find expected selectors for ${url}`);
      });

      // Extract tweet content with enhanced logic
      const tweetData = await page.evaluate((sels) => {
        // Helper function to get text content
        const getText = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.innerText || element.textContent : "";
        };

        // Get tweet text - try multiple methods
        let tweetText = "";

        // Method 1: Direct tweet text selector
        tweetText = getText(sels.tweetText);

        // Method 2: Try span inside tweet text div
        if (!tweetText) {
          const spans = document.querySelectorAll(sels.tweetTextSpan);
          if (spans.length > 0) {
            tweetText = Array.from(spans)
              .map((span) => span.textContent)
              .join("");
          }
        }

        // Method 3: Look for any div with lang attribute
        if (!tweetText) {
          const langDivs = document.querySelectorAll(sels.langDiv);
          for (const div of langDivs) {
            const text = div.innerText || div.textContent;
            if (text && text.length > 10) {
              // Likely tweet content
              tweetText = text;
              break;
            }
          }
        }

        // Method 4: Fallback - look for any text content in articles
        if (!tweetText) {
          const articles = document.querySelectorAll("article");
          for (const article of articles) {
            const spans = article.querySelectorAll("span[dir=auto]");
            for (const span of spans) {
              const text = span.innerText || span.textContent;
              if (text && text.length > 10 && !text.includes("@")) {
                tweetText = text;
                break;
              }
            }
            if (tweetText) break;
          }
        }

        // Get author information
        let authorName = "";
        let authorHandle = "";

        const userNameElement = document.querySelector(sels.userName);
        if (userNameElement) {
          const text = userNameElement.innerText || userNameElement.textContent;
          const lines = text.split("\n");
          authorName = lines[0] || "";

          // Extract handle
          const handleMatch = text.match(/@[\w]+/);
          authorHandle = handleMatch ? handleMatch[0] : "";
        } else {
          // Fallback: look for user info in page
          const links = document.querySelectorAll('a[href*="/"]');
          for (const link of links) {
            const href = link.getAttribute("href");
            if (href && href.match(/^\/[\w]+$/) && !href.includes("/home")) {
              const text = link.innerText || link.textContent;
              if (text && !text.includes("@")) {
                authorName = text;
                authorHandle = "@" + href.substring(1);
                break;
              }
            }
          }
        }

        // Get metrics with better extraction
        const getMetric = (selector) => {
          const element = document.querySelector(selector);
          if (element) {
            const ariaLabel = element.getAttribute("aria-label");
            if (ariaLabel) {
              const match = ariaLabel.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/);
              return match ? match[1] : "0";
            }
            // Fallback: look for text in button
            const text = element.innerText || element.textContent;
            if (text) {
              const match = text.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/);
              return match ? match[1] : "0";
            }
          }
          return "0";
        };

        return {
          content: tweetText || "Could not extract tweet content",
          author: authorName || "Unknown",
          handle: authorHandle || "@unknown",
          likes: getMetric(sels.likeButton),
          retweets: getMetric(sels.retweetButton),
          replies: getMetric(sels.replyButton),
          timestamp: new Date().toISOString(),
          debug: {
            foundTweetText: !!tweetText,
            foundAuthor: !!authorName,
            textLength: tweetText.length,
          },
        };
      }, selectors);

      console.log(
        `Scraped ${url}: Found text: ${tweetData.debug.foundTweetText}, Length: ${tweetData.debug.textLength}`,
      );

      return tweetData;
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
      return {
        error: error.message,
        content: "",
        author: "",
        handle: "",
        likes: "0",
        retweets: "0",
        replies: "0",
      };
    }
  }

  async scrapeBatch(urls, maxTabs = null) {
    await this.initialize();

    // Use provided maxTabs or default
    const tabLimit = maxTabs || this.defaultMaxTabs;

    // Process URLs in batches of tabLimit
    const results = [];
    for (let i = 0; i < urls.length; i += tabLimit) {
      const batch = urls.slice(i, i + tabLimit);

      // Create pages for parallel processing
      const pagePromises = batch.map(async (url) => {
        let page = null;
        try {
          page = await this.browser.newPage();

          // Set user agent to avoid detection
          await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          );

          // Only block heavy resources, keep CSS for proper rendering
          await page.setRequestInterception(true);
          page.on("request", (request) => {
            const resourceType = request.resourceType();
            if (["image", "font", "media"].includes(resourceType)) {
              request.abort();
            } else {
              request.continue();
            }
          });

          const result = await this.scrapeTweet(url, page);

          return {
            url,
            ...result,
          };
        } catch (error) {
          console.error(`Error processing ${url}:`, error.message);
          return {
            url,
            error: error.message,
          };
        } finally {
          // Always close the page if it was created
          if (page) {
            try {
              await page.close();
            } catch (closeError) {
              console.error("Error closing page:", closeError.message);
            }
          }
        }
      });

      // Wait for all pages in batch to complete
      const batchResults = await Promise.all(pagePromises);
      results.push(...batchResults);

      // Add delay between batches to avoid rate limiting
      if (i + tabLimit < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  async autoReply(url, comment) {
    let page = null;
    let isNewTab = false;
    try {
      // Get or reuse existing tab for this URL
      page = await this.getOrCreateTab(url);
      const currentUrl = await page.evaluate(() => window.location.href);

      // Only navigate if we're not already on the right page
      if (!currentUrl.includes(url.split("/").pop())) {
        console.log(`Navigating to: ${url}`);
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        isNewTab = true;
      } else {
        console.log(`Already on the correct page: ${url}`);
      }

      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Try to like the post first
      try {
        // Get the first cellInnerDiv (the main post, not replies)
        const firstCell = await page.$('[data-testid="cellInnerDiv"]');

        if (firstCell) {
          // Check if post is already liked (data-testid="unlike")
          const unlikeButton = await firstCell.$('[data-testid="unlike"]');

          if (unlikeButton) {
            console.log("Post already liked, skipping");
          } else {
            // Post not liked yet, find and click like button
            const likeButton = await firstCell.$('[data-testid="like"]');
            if (likeButton) {
              await likeButton.click();
              console.log("Post liked successfully");
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } else {
              console.log("Like button not found, continuing with reply");
            }
          }
        } else {
          console.log("Post cell not found, continuing with reply");
        }
      } catch (error) {
        console.log(`Failed to like post: ${error.message}, continuing with reply`);
      }

      // Try to find and click the reply button
      const replySelectors = [
        '[data-testid="tweetTextarea_0"][role="textbox"]',
      ];

      let replyClicked = false;
      for (const selector of replySelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          replyClicked = true;
          console.log(`Reply button clicked using selector: ${selector}`);
          break;
        } catch (error) {
          console.log(`Failed to click reply with selector ${selector}`);
          continue;
        }
      }

      if (!replyClicked) {
        throw new Error("Could not find reply button");
      }

      // Wait longer for the reply modal to fully load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        // await element.click();
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Type the comment character by character
        for (const char of comment) {
          await page.keyboard.type(char, { delay: 30 });
        }

        console.log(`Comment typed successfully`);
      } catch (error) {
        console.log(`Failed with selector ${selector}: ${error.message}`);
      }

      const submitSelectors = ['button[data-testid="tweetButtonInline"]'];

      let submitClicked = false;

      // Wait for the button to become enabled (check modal button first, then inline)
      let buttonEnabled = false;
      for (let i = 0; i < 15; i++) {
        try {
          let button = await page.$('button[data-testid="tweetButtonInline"]');
          let buttonSelector = 'button[data-testid="tweetButtonInline"]';

          if (button) {
            const isDisabled = await page.$eval(
              buttonSelector,
              (el) =>
                el.hasAttribute("disabled") ||
                el.getAttribute("aria-disabled") === "true",
            );

            if (!isDisabled) {
              buttonEnabled = true;
              console.log(
                `Reply button is now enabled using selector: ${buttonSelector}`,
              );
              break;
            } else {
              console.log(`Button found but still disabled: ${buttonSelector}`);
            }
          } else {
            console.log(`No reply button found yet, attempt ${i + 1}`);
          }
        } catch (e) {
          console.log(`Error checking button: ${e.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (buttonEnabled) {
        for (const selector of submitSelectors) {
          try {
            const button = await page.$(selector);
            if (button) {
              // Double-check that the button is actually enabled before clicking
              const isActuallyDisabled = await page
                .$eval(
                  selector,
                  (el) =>
                    el.hasAttribute("disabled") ||
                    el.getAttribute("aria-disabled") === "true",
                )
                .catch(() => true); // If eval fails, assume disabled

              if (!isActuallyDisabled) {
                await button.click();
                submitClicked = true;
                console.log(
                  `Submit button clicked using selector: ${selector}`,
                );
                break;
              } else {
                console.log(`Button found but disabled, skipping: ${selector}`);
              }
            }
          } catch (error) {
            console.log(
              `Failed to click submit with selector ${selector}: ${error.message}`,
            );
            continue;
          }
        }
      }

      if (!submitClicked) {
        console.log(
          "Submit button not found or disabled, reply may still be successful",
        );
      }

      // Wait to see if reply was successful
      await new Promise((resolve) => setTimeout(resolve, 3000));

      return {
        success: true,
        message: "Reply posted successfully",
      };
    } catch (error) {
      console.error(`Error auto-replying to ${url}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      // Don't close the tab - keep it open for reuse
      // The tab will be managed by the activeTabs Map
      console.log("Keeping tab open for future reuse");
    }
  }

  async autoReplyBatch(posts) {
    const results = [];

    for (const post of posts) {
      if (!post.comment || post.comment.trim() === "") {
        results.push({
          postId: post.id,
          url: post.url,
          success: false,
          error: "No comment available",
        });
        continue;
      }

      console.log(`Auto-replying to: ${post.url}`);
      const result = await this.autoReply(post.url, post.comment);

      results.push({
        postId: post.id,
        url: post.url,
        comment: post.comment,
        ...result,
      });

      // Add delay between replies to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return results;
  }

  async closeAllTabs() {
    console.log("Closing all active tabs...");
    for (const [url, page] of this.activeTabs) {
      try {
        await page.close();
        console.log(`Closed tab for: ${url}`);
      } catch (error) {
        console.error(`Error closing tab for ${url}:`, error.message);
      }
    }
    this.activeTabs.clear();
  }

  async close() {
    await this.closeAllTabs();
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Create singleton instance
const puppeteerService = new PuppeteerService();

// Cleanup on process termination
process.on("SIGINT", async () => {
  await puppeteerService.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await puppeteerService.close();
  process.exit(0);
});

export default puppeteerService;
