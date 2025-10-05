import express from "express";
import { generateComment, generateBulkComments } from "../services/aiService.js";

const router = express.Router();

// Generate AI comment for a specific post
router.post("/generate", async (req, res) => {
  try {
    const { postId, provider, maxLength, additionalPrompt } = req.body;

    if (!postId || !provider) {
      return res.status(400).json({
        message: "Post ID and provider are required",
      });
    }

    // Get API key from environment variables
    const apiKey =
      provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "anthropic"
          ? process.env.ANTHROPIC_API_KEY
          : provider === "gemini"
            ? process.env.GEMINI_API_KEY
            : null;

    if (!apiKey) {
      return res.status(400).json({
        message: `${provider.toUpperCase()} API key not configured in server environment`,
      });
    }

    // Find the post in user session
    const post = req.userSession.posts.find((p) => p.id === postId);
    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    if (!post.content || post.content.trim() === "") {
      return res.status(400).json({
        message: "Post content is empty. Please scrape the content first.",
      });
    }

    // Use shared AI service
    const generatedComment = await generateComment(
      post,
      provider,
      apiKey,
      maxLength,
      additionalPrompt,
    );

    // Update the post in session
    const postIndex = req.userSession.posts.findIndex((p) => p.id === postId);
    req.userSession.posts[postIndex] = {
      ...req.userSession.posts[postIndex],
      comment: generatedComment,
      status: "commented",
    };

    res.json({
      success: true,
      comment: generatedComment,
      message: `Comment generated using ${provider.toUpperCase()}`,
    });
  } catch (error) {
    console.error("AI generation error:", error);
    res.status(500).json({
      message: "Failed to generate comment",
      error: error.message,
    });
  }
});

// Bulk generate comments for multiple posts
router.post("/generate-bulk", async (req, res) => {
  try {
    const { postIds, provider, maxLength, additionalPrompt } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        message: "Post IDs array is required",
      });
    }

    if (!provider) {
      return res.status(400).json({
        message: "AI provider is required",
      });
    }

    // Get API key from environment
    const apiKey =
      provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "anthropic"
          ? process.env.ANTHROPIC_API_KEY
          : provider === "gemini"
            ? process.env.GEMINI_API_KEY
            : null;

    if (!apiKey) {
      return res.status(400).json({
        message: `${provider.toUpperCase()} API key not configured in server environment`,
      });
    }

    // Get posts from session
    const posts = req.userSession.posts.filter((p) => postIds.includes(p.id));

    if (posts.length === 0) {
      return res.status(404).json({
        message: "No posts found with the provided IDs",
      });
    }

    // Filter posts that have content
    const postsWithContent = posts.filter((p) => p.content && p.content.trim() !== "");

    if (postsWithContent.length === 0) {
      return res.status(400).json({
        message: "None of the posts have content. Please scrape content first.",
      });
    }

    // Use shared AI service for bulk generation
    const results = await generateBulkComments(
      postsWithContent,
      provider,
      apiKey,
      maxLength,
      additionalPrompt,
    );

    // Update posts in session
    results.forEach((result) => {
      if (result.success) {
        const postIndex = req.userSession.posts.findIndex((p) => p.id === result.postId);
        if (postIndex !== -1) {
          req.userSession.posts[postIndex] = {
            ...req.userSession.posts[postIndex],
            comment: result.comment,
            status: "commented",
          };
        }
      }
    });

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      comments: results.filter((r) => r.success).map((r) => ({ postId: r.postId, comment: r.comment })),
      message: `Generated ${successCount} comments successfully. ${failureCount} failed.`,
      stats: {
        total: results.length,
        generated: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    console.error("Bulk AI generation error:", error);
    res.status(500).json({
      message: "Failed to generate comments in bulk",
      error: error.message,
    });
  }
});

export default router;
