import express from "express";
import puppeteerService from "../services/puppeteerService.js";

const router = express.Router();

// Auto reply to a single post
router.post("/single", async (req, res) => {
  try {
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: "Post ID is required",
      });
    }

    // Find the post in user session
    const post = req.userSession.posts.find((p) => p.id === postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (!post.comment || post.comment.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "No comment available for this post",
      });
    }

    console.log(`Starting auto-reply for post: ${post.url}`);

    // Perform automated reply
    const result = await puppeteerService.autoReply(post.url, post.comment);

    if (result.success) {
      // Update post status in session
      const postIndex = req.userSession.posts.findIndex((p) => p.id === postId);
      req.userSession.posts[postIndex] = {
        ...req.userSession.posts[postIndex],
        status: "replied",
        repliedAt: new Date().toISOString(),
        autoReplied: true,
      };
    }

    res.json({
      success: result.success,
      message: result.success
        ? "Reply posted automatically"
        : "Failed to post reply",
      error: result.error,
      postId: postId,
      url: post.url,
    });
  } catch (error) {
    console.error("Auto-reply error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to auto-reply to post",
      error: error.message,
    });
  }
});

// Auto reply to multiple posts
router.post("/batch", async (req, res) => {
  try {
    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Post IDs array is required",
      });
    }

    // Get posts from session
    const posts = req.userSession.posts.filter((p) => postIds.includes(p.id));

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No posts found",
      });
    }

    // Filter posts that have comments and aren't already replied
    const postsToReply = posts.filter(
      (post) =>
        post.comment && post.comment.trim() !== "" && post.status !== "replied",
    );

    if (postsToReply.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No posts available for auto-reply. Posts need comments and must not be already replied to.",
      });
    }

    console.log(`Starting batch auto-reply for ${postsToReply.length} posts`);

    // Perform batch auto-reply
    const results = await puppeteerService.autoReplyBatch(postsToReply);

    // Update posts in session based on results
    req.userSession.posts = req.userSession.posts.map((post) => {
      const result = results.find((r) => r.postId === post.id);
      if (result && result.success) {
        return {
          ...post,
          status: "replied",
          repliedAt: new Date().toISOString(),
          autoReplied: true,
        };
      }
      return post;
    });

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      message: `Auto-reply completed: ${successCount} successful, ${failCount} failed`,
      results: results,
      stats: {
        total: postsToReply.length,
        successful: successCount,
        failed: failCount,
      },
    });
  } catch (error) {
    console.error("Batch auto-reply error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform batch auto-reply",
      error: error.message,
    });
  }
});

// Get auto-reply status
router.get("/status", (req, res) => {
  const posts = req.userSession.posts || [];
  const repliedCount = posts.filter((p) => p.status === "replied").length;
  const pendingCount = posts.filter(
    (p) => p.comment && p.status !== "replied",
  ).length;

  res.json({
    success: true,
    totalPosts: posts.length,
    repliedPosts: repliedCount,
    pendingPosts: pendingCount,
    autoRepliedPosts: posts.filter((p) => p.autoReplied).length,
  });
});

// Cancel auto-reply batch process
router.post("/cancel", (req, res) => {
  try {
    puppeteerService.cancelAutoReplyBatch();
    res.json({
      success: true,
      message: "Auto-reply process cancellation requested",
    });
  } catch (error) {
    console.error("Cancel auto-reply error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel auto-reply process",
      error: error.message,
    });
  }
});

export default router;

