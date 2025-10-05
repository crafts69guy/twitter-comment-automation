import express from "express";
import puppeteerService from "../services/puppeteerService.js";

const router = express.Router();

// Scrape multiple Twitter posts in parallel using service
router.post("/scrape-posts", async (req, res) => {
  const { postIds, maxTabs } = req.body;

  if (!postIds || !Array.isArray(postIds)) {
    return res.status(400).json({
      message: "Post IDs array is required",
    });
  }

  // Get posts from user session
  const posts = req.userSession.posts || [];
  const postsToScrape = posts.filter((post) => postIds.includes(post.id));

  if (postsToScrape.length === 0) {
    return res.status(400).json({
      message: "No valid posts found to scrape",
    });
  }

  try {
    console.log(`Starting to scrape ${postsToScrape.length} posts...`);

    // Extract URLs for scraping
    const urls = postsToScrape.map((post) => post.url);

    // Use puppeteer service to scrape in parallel batches with configurable maxTabs
    const scrapedData = await puppeteerService.scrapeBatch(urls, maxTabs || 5);

    // Update posts in session with scraped content
    req.userSession.posts = req.userSession.posts.map((post) => {
      const scraped = scrapedData.find((data) => data.url === post.url);

      if (scraped && !scraped.error) {
        return {
          ...post,
          content: scraped.content || post.content,
          authorName: scraped.author,
          authorHandle: scraped.handle,
          metrics: {
            likes: scraped.likes,
            retweets: scraped.retweets,
            replies: scraped.replies,
          },
          scrapedAt: scraped.timestamp,
          scraped: true,
        };
      } else if (postIds.includes(post.id)) {
        return {
          ...post,
          scraped: false,
          scrapeError: scraped?.error || "Failed to scrape",
        };
      }
      return post;
    });

    const successCount = scrapedData.filter((d) => !d.error).length;
    const failCount = scrapedData.filter((d) => d.error).length;

    res.json({
      success: true,
      message: `Scraped ${successCount} posts successfully, ${failCount} failed`,
      results: scrapedData.map((data) => ({
        url: data.url,
        success: !data.error,
        data: data.error
          ? null
          : {
              content: data.content,
              author: data.author,
              handle: data.handle,
              metrics: {
                likes: data.likes,
                retweets: data.retweets,
                replies: data.replies,
              },
            },
        error: data.error,
      })),
      stats: {
        total: postsToScrape.length,
        successful: successCount,
        failed: failCount,
      },
    });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({
      message: "Failed to scrape posts",
      error: error.message,
    });
  }
});

export default router;
