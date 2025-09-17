import express from "express";
import puppeteerService from "../services/puppeteerService.js";

const router = express.Router();

// Scrape Twitter post content using Puppeteer
async function scrapeTwitterPost(url, page) {
  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for the main tweet content to load
    await page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 });

    // Extract tweet content
    const tweetData = await page.evaluate(() => {
      const tweetTextElement = document.querySelector(
        '[data-testid="tweetText"]'
      );
      const authorElement = document.querySelector(
        '[data-testid="User-Name"] span'
      );
      const likesElement = document.querySelector('[data-testid="like"] span');
      const retweetsElement = document.querySelector(
        '[data-testid="retweet"] span'
      );

      return {
        content: tweetTextElement ? tweetTextElement.innerText : "",
        author: authorElement ? authorElement.innerText : "",
        likes: likesElement ? likesElement.innerText : "0",
        retweets: retweetsElement ? retweetsElement.innerText : "0",
      };
    });

    return {
      success: true,
      data: tweetData,
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return {
      success: false,
      error: error.message,
      data: {
        content: "Failed to scrape content",
        author: "Unknown",
        likes: "0",
        retweets: "0",
      },
    };
  }
}

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

// Demo scraping endpoint that returns mock data
// router.post("/scrape-demo", async (req, res) => {
//   const { postIds } = req.body;
//
//   if (!postIds || !Array.isArray(postIds)) {
//     return res.status(400).json({
//       message: "Post IDs array is required",
//     });
//   }
//
//   // Simulate scraping delay
//   await new Promise((resolve) => setTimeout(resolve, 2000));
//
//   // Get posts from user session
//   const posts = req.userSession.posts || [];
//   const postsToScrape = posts.filter((post) => postIds.includes(post.id));
//
//   // Mock scraped data
//   const mockScrapedData = [
//     "The future of AI is incredibly exciting! We're making great progress with neural networks and machine learning algorithms. This technology will transform how we work and live.",
//     "Google's latest breakthrough in quantum computing represents a major milestone in computational science. The implications for cryptography and drug discovery are immense.",
//     "Microsoft Azure's new AI capabilities are empowering developers worldwide to build more intelligent applications. The cloud-first approach is accelerating innovation.",
//     "Blue Origin's latest mission was a success! Space exploration continues to push the boundaries of human achievement. The future is among the stars.",
//     "Apple's commitment to privacy and user security remains our top priority as we innovate with new technologies. Privacy is a fundamental human right.",
//   ];
//
//   // Update posts with mock scraped content
//   req.userSession.posts = req.userSession.posts.map((post) => {
//     if (postIds.includes(post.id)) {
//       const randomContent =
//         mockScrapedData[Math.floor(Math.random() * mockScrapedData.length)];
//       return {
//         ...post,
//         content: randomContent,
//         author: post.url.includes("elonmusk")
//           ? "Elon Musk"
//           : post.url.includes("sundarpichai")
//             ? "Sundar Pichai"
//             : post.url.includes("satyanadella")
//               ? "Satya Nadella"
//               : post.url.includes("jeffbezos")
//                 ? "Jeff Bezos"
//                 : post.url.includes("tim_cook")
//                   ? "Tim Cook"
//                   : "Unknown",
//         likes: Math.floor(Math.random() * 10000) + 100,
//         retweets: Math.floor(Math.random() * 1000) + 10,
//       };
//     }
//     return post;
//   });
//
//   res.json({
//     success: true,
//     message: `Demo scraping completed for ${postsToScrape.length} posts`,
//     results: postsToScrape.map((post) => ({
//       postId: post.id,
//       url: post.url,
//       success: true,
//       data: {
//         content: req.userSession.posts.find((p) => p.id === post.id).content,
//       },
//     })),
//     stats: {
//       total: postsToScrape.length,
//       successful: postsToScrape.length,
//       failed: 0,
//     },
//   });
// });

export default router;
