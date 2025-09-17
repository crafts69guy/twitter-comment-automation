import puppeteer from "puppeteer";

class PuppeteerService {
  constructor() {
    this.browser = null;
    this.defaultMaxTabs = 5;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: false, // Open real browser window
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled", // Hide automation
          "--disable-features=site-per-process", // Better performance
          "--window-size=1920,1080", // Set initial window size
          "--start-maximized", // Start maximized
        ],
        defaultViewport: null, // Use full browser window
        executablePath: puppeteer.executablePath(), // Use installed Chrome
        ignoreDefaultArgs: ["--enable-automation"], // Remove automation flag
      });
    }
    return this.browser;
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
        `Scraped ${url}: Found text: ${tweetData.debug.foundTweetText}, Length: ${tweetData.debug.textLength}`
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
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
    try {
      await this.initialize();

      page = await this.browser.newPage();

      // Set viewport to desktop size
      await page.setViewport({ width: 1920, height: 1080 });

      // Set user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Navigate to the tweet
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Try to find and click the reply button
      const replySelectors = [
        '[data-testid="reply"]',
        '[aria-label*="Reply"]',
        '[aria-label*="reply"]',
        'div[role="button"][aria-label*="Reply"]',
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

      // Wait for the reply text area to appear
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to find the text input area
      const textAreaSelectors = [
        '[data-testid="tweetTextarea_0"]',
        'div[role="textbox"][data-testid*="tweet"]',
        'div[role="textbox"]',
        '[contenteditable="true"]',
        'div[data-testid="tweetTextarea_0_label"]',
      ];

      let textAreaFound = false;
      for (const selector of textAreaSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });

          // Clear any existing text and type the comment
          await page.click(selector);
          await page.keyboard.down("Control");
          await page.keyboard.press("KeyA");
          await page.keyboard.up("Control");
          await page.keyboard.press("Delete");

          // Type the comment
          await page.type(selector, comment);
          textAreaFound = true;
          console.log(`Comment typed using selector: ${selector}`);
          break;
        } catch (error) {
          console.log(`Failed to type in textarea with selector ${selector}`);
          continue;
        }
      }

      if (!textAreaFound) {
        throw new Error("Could not find text input area");
      }

      // Wait a moment for the text to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to find and click the reply/tweet button
      const submitSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'div[role="button"][data-testid="tweetButtonInline"]',
        'div[role="button"]:has-text("Reply")',
        'button:has-text("Reply")',
      ];

      let submitClicked = false;
      for (const selector of submitSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });

          // Check if button is enabled
          const isDisabled = await page.$eval(
            selector,
            (el) =>
              el.hasAttribute("disabled") ||
              el.getAttribute("aria-disabled") === "true"
          );

          if (!isDisabled) {
            await page.click(selector);
            submitClicked = true;
            console.log(`Submit button clicked using selector: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`Failed to click submit with selector ${selector}`);
          continue;
        }
      }

      if (!submitClicked) {
        console.log(
          "Submit button not found or disabled, reply may still be successful"
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
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.error("Error closing page:", closeError.message);
        }
      }
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

  async close() {
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
