import express from 'express';
import puppeteer from 'puppeteer';

const router = express.Router();

// Scrape Twitter post content using Puppeteer
async function scrapeTwitterPost(url, page) {
  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for the main tweet content to load
    await page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 });

    // Extract tweet content
    const tweetData = await page.evaluate(() => {
      const tweetTextElement = document.querySelector('[data-testid="tweetText"]');
      const authorElement = document.querySelector('[data-testid="User-Name"] span');
      const likesElement = document.querySelector('[data-testid="like"] span');
      const retweetsElement = document.querySelector('[data-testid="retweet"] span');

      return {
        content: tweetTextElement ? tweetTextElement.innerText : '',
        author: authorElement ? authorElement.innerText : '',
        likes: likesElement ? likesElement.innerText : '0',
        retweets: retweetsElement ? retweetsElement.innerText : '0'
      };
    });

    return {
      success: true,
      data: tweetData
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      data: {
        content: 'Failed to scrape content',
        author: 'Unknown',
        likes: '0',
        retweets: '0'
      }
    };
  }
}

// Scrape multiple Twitter posts in parallel
router.post('/scrape-posts', async (req, res) => {
  const { postIds } = req.body;

  if (!postIds || !Array.isArray(postIds)) {
    return res.status(400).json({
      message: 'Post IDs array is required'
    });
  }

  // Get posts from user session
  const posts = req.userSession.posts || [];
  const postsToScrape = posts.filter(post => postIds.includes(post.id));

  if (postsToScrape.length === 0) {
    return res.status(400).json({
      message: 'No valid posts found to scrape'
    });
  }

  let browser;
  try {
    // Launch browser with 5 parallel tabs
    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    // Create multiple pages for parallel scraping (max 5)
    const maxTabs = 5;
    const pages = [];
    for (let i = 0; i < Math.min(maxTabs, postsToScrape.length); i++) {
      const page = await browser.newPage();

      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      pages.push(page);
    }

    // Process posts in batches using available tabs
    const results = [];
    for (let i = 0; i < postsToScrape.length; i += maxTabs) {
      const batch = postsToScrape.slice(i, i + maxTabs);
      const batchPromises = batch.map((post, index) => {
        const page = pages[index];
        return scrapeTwitterPost(post.url, page).then(result => ({
          postId: post.id,
          url: post.url,
          ...result
        }));
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Update posts in session with scraped content
    req.userSession.posts = req.userSession.posts.map(post => {
      const scrapedData = results.find(result => result.postId === post.id);
      if (scrapedData && scrapedData.success) {
        return {
          ...post,
          content: scrapedData.data.content,
          author: scrapedData.data.author,
          likes: scrapedData.data.likes,
          retweets: scrapedData.data.retweets
        };
      }
      return post;
    });

    await browser.close();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Scraped ${successCount} posts successfully, ${failCount} failed`,
      results: results,
      stats: {
        total: results.length,
        successful: successCount,
        failed: failCount
      }
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }

    console.error('Scraping error:', error);
    res.status(500).json({
      message: 'Failed to scrape posts',
      error: error.message
    });
  }
});

// Demo scraping endpoint that returns mock data
router.post('/scrape-demo', async (req, res) => {
  const { postIds } = req.body;

  if (!postIds || !Array.isArray(postIds)) {
    return res.status(400).json({
      message: 'Post IDs array is required'
    });
  }

  // Simulate scraping delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get posts from user session
  const posts = req.userSession.posts || [];
  const postsToScrape = posts.filter(post => postIds.includes(post.id));

  // Mock scraped data
  const mockScrapedData = [
    "The future of AI is incredibly exciting! We're making great progress with neural networks and machine learning algorithms. This technology will transform how we work and live.",
    "Google's latest breakthrough in quantum computing represents a major milestone in computational science. The implications for cryptography and drug discovery are immense.",
    "Microsoft Azure's new AI capabilities are empowering developers worldwide to build more intelligent applications. The cloud-first approach is accelerating innovation.",
    "Blue Origin's latest mission was a success! Space exploration continues to push the boundaries of human achievement. The future is among the stars.",
    "Apple's commitment to privacy and user security remains our top priority as we innovate with new technologies. Privacy is a fundamental human right."
  ];

  // Update posts with mock scraped content
  req.userSession.posts = req.userSession.posts.map(post => {
    if (postIds.includes(post.id)) {
      const randomContent = mockScrapedData[Math.floor(Math.random() * mockScrapedData.length)];
      return {
        ...post,
        content: randomContent,
        author: post.url.includes('elonmusk') ? 'Elon Musk' :
               post.url.includes('sundarpichai') ? 'Sundar Pichai' :
               post.url.includes('satyanadella') ? 'Satya Nadella' :
               post.url.includes('jeffbezos') ? 'Jeff Bezos' :
               post.url.includes('tim_cook') ? 'Tim Cook' : 'Unknown',
        likes: Math.floor(Math.random() * 10000) + 100,
        retweets: Math.floor(Math.random() * 1000) + 10
      };
    }
    return post;
  });

  res.json({
    success: true,
    message: `Demo scraping completed for ${postsToScrape.length} posts`,
    results: postsToScrape.map(post => ({
      postId: post.id,
      url: post.url,
      success: true,
      data: {
        content: req.userSession.posts.find(p => p.id === post.id).content
      }
    })),
    stats: {
      total: postsToScrape.length,
      successful: postsToScrape.length,
      failed: 0
    }
  });
});

router.get('/test', (req, res) => {
  res.json({ message: 'Scraper route working' });
});

export default router;