import express from "express";

const router = express.Router();

// Get current posts from user session
router.get("/current", (req, res) => {
  try {
    const posts = req.userSession.posts || [];

    res.json({
      success: true,
      posts,
      message: `Retrieved ${posts.length} posts from session`,
    });
  } catch (error) {
    console.error("Error getting current posts:", error);
    res.status(500).json({
      message: "Failed to get current posts",
      error: error.message,
    });
  }
});

// Update a specific post
router.patch("/:postId", (req, res) => {
  try {
    const { postId } = req.params;
    const updates = req.body;

    const postIndex = req.userSession.posts.findIndex((p) => p.id === postId);

    if (postIndex === -1) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Update the post
    req.userSession.posts[postIndex] = {
      ...req.userSession.posts[postIndex],
      ...updates,
    };

    res.json({
      success: true,
      post: req.userSession.posts[postIndex],
      message: "Post updated successfully",
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({
      message: "Failed to update post",
      error: error.message,
    });
  }
});

export default router;

