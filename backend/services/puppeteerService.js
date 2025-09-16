import puppeteer from "puppeteer";

class PuppeteerService {
  constructor() {
    this.browser = null;
    this.maxTabs = 5;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: process.env.PUPPETEER_HEADLESS === "true",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
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

  async scrapeBatch(urls) {
    await this.initialize();

    // Process URLs in batches of maxTabs
    const results = [];
    for (let i = 0; i < urls.length; i += this.maxTabs) {
      const batch = urls.slice(i, i + this.maxTabs);

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
      if (i + this.maxTabs < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
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
