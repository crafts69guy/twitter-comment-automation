import express from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

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

    let generatedComment;

    if (provider === "openai") {
      generatedComment = await generateOpenAIComment(
        post,
        apiKey,
        maxLength,
        additionalPrompt,
      );
    } else if (provider === "anthropic") {
      generatedComment = await generateAnthropicComment(
        post,
        apiKey,
        maxLength,
        additionalPrompt,
      );
    } else if (provider === "gemini") {
      generatedComment = await generateGeminiComment(
        post,
        apiKey,
        maxLength,
        additionalPrompt,
      );
    } else {
      return res.status(400).json({
        message: 'Invalid AI provider. Use "openai", "anthropic", or "gemini"',
      });
    }

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

// Generate comment using OpenAI
async function generateOpenAIComment(
  post,
  apiKey,
  maxLength = 280,
  additionalPrompt = "",
  retryCount = 0,
) {
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  const charLimit = Math.min(maxLength || 280, 280); // Never exceed Twitter's 280 char limit
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : "";

  // Add stronger brevity instructions on retry
  const retryInstructions =
    retryCount > 0
      ? `\n- EXTREMELY IMPORTANT: Keep response very brief and concise\n- Use shorter sentences and fewer words\n- Aim for ${Math.max(charLimit - 20, 20)} characters or less`
      : "";

  const prompt = `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 🚨 CRITICAL: MUST be under ${charLimit} characters total (count carefully!)
- Include relevant insights or questions
- Avoid generic responses${customInstructions}${retryInstructions}

Original post by ${post.author || "Unknown"}:
"${post.content}"

Generate only the reply text, no quotes or extra formatting. MUST be under ${charLimit} characters:`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful social media assistant that generates thoughtful, engaging Twitter replies. Be professional, authentic, and add value to conversations. NEVER exceed the character limit. Be extremely concise.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: Math.ceil(charLimit * 1.5), // Allow some buffer for generation
    temperature: 0.7,
  });

  let comment = response.choices[0].message.content.trim();

  // Check character limit and retry if exceeded (max 2 retries)
  if (comment.length > charLimit && retryCount < 2) {
    console.log(
      `⚠️ Comment too long (${comment.length} chars), retrying attempt ${retryCount + 1}/2 with stricter instructions...`,
    );
    return await generateOpenAIComment(
      post,
      apiKey,
      maxLength,
      additionalPrompt,
      retryCount + 1,
    );
  }

  // If still over limit after retries, throw error
  if (comment.length > charLimit) {
    throw new Error(
      `Generated comment (${comment.length} chars) still exceeds limit of ${charLimit} characters after ${retryCount + 1} attempts. Please reduce the character limit.`,
    );
  }

  // Double-check against Twitter's absolute maximum
  if (comment.length > 280) {
    throw new Error(
      `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit.`,
    );
  }

  console.log(
    `✅ Comment generated successfully (${comment.length}/${charLimit} chars)${retryCount > 0 ? ` after ${retryCount + 1} attempts` : ""}`,
  );
  return comment;
}

// Generate comment using Anthropic Claude
async function generateAnthropicComment(
  post,
  apiKey,
  maxLength = 280,
  additionalPrompt = "",
  retryCount = 0,
) {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const charLimit = Math.min(maxLength || 280, 280); // Never exceed Twitter's 280 char limit
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : "";

  // Add stronger brevity instructions on retry
  const retryInstructions =
    retryCount > 0
      ? `\n- EXTREMELY IMPORTANT: Keep response very brief and concise\n- Use shorter sentences and fewer words\n- Aim for ${Math.max(charLimit - 20, 20)} characters or less`
      : "";

  const prompt = `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 🚨 CRITICAL: MUST be under ${charLimit} characters total (count carefully!)
- Include relevant insights or questions
- Avoid generic responses${customInstructions}${retryInstructions}

Original post by ${post.author || "Unknown"}:
"${post.content}"

Generate only the reply text, no quotes or extra formatting. MUST be under ${charLimit} characters:`;

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: Math.ceil(charLimit * 1.5), // Allow some buffer for generation
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  let comment = response.content[0].text.trim();

  // Check character limit and retry if exceeded (max 2 retries)
  if (comment.length > charLimit && retryCount < 2) {
    console.log(
      `⚠️ Comment too long (${comment.length} chars), retrying attempt ${retryCount + 1}/2 with stricter instructions...`,
    );
    return await generateAnthropicComment(
      post,
      apiKey,
      maxLength,
      additionalPrompt,
      retryCount + 1,
    );
  }

  // If still over limit after retries, throw error
  if (comment.length > charLimit) {
    throw new Error(
      `Generated comment (${comment.length} chars) still exceeds limit of ${charLimit} characters after ${retryCount + 1} attempts. Please reduce the character limit.`,
    );
  }

  // Double-check against Twitter's absolute maximum
  if (comment.length > 280) {
    throw new Error(
      `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit.`,
    );
  }

  console.log(
    `✅ Comment generated successfully (${comment.length}/${charLimit} chars)${retryCount > 0 ? ` after ${retryCount + 1} attempts` : ""}`,
  );
  return comment;
}

// Generate comment using Google Gemini
async function generateGeminiComment(
  post,
  apiKey,
  maxLength = 280,
  additionalPrompt = "",
  retryCount = 0,
) {
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });

  const charLimit = Math.min(maxLength || 280, 280); // Never exceed Twitter's 280 char limit
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : "";

  // Add stronger brevity instructions on retry
  const retryInstructions =
    retryCount > 0
      ? `\n- EXTREMELY IMPORTANT: Keep response very brief and concise\n- Use shorter sentences and fewer words\n- Aim for ${Math.max(charLimit - 20, 20)} characters or less`
      : "";

  const prompt = `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 🚨 CRITICAL: MUST be under ${charLimit} characters total (count carefully!)
- Include relevant insights or questions
- Avoid generic responses${customInstructions}${retryInstructions}

Original post by ${post.author || post.authorName || "Unknown"}:
"${post.content}"

Generate only the reply text, no quotes or extra formatting. MUST be under ${charLimit} characters:`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  let comment = response.text.trim();

  // Check character limit and retry if exceeded (max 2 retries)
  if (comment.length > charLimit && retryCount < 2) {
    console.log(
      `⚠️ Comment too long (${comment.length} chars), retrying attempt ${retryCount + 1}/2 with stricter instructions...`,
    );
    return await generateGeminiComment(
      post,
      apiKey,
      maxLength,
      additionalPrompt,
      retryCount + 1,
    );
  }

  // If still over limit after retries, throw error
  if (comment.length > charLimit) {
    throw new Error(
      `Generated comment (${comment.length} chars) still exceeds limit of ${charLimit} characters after ${retryCount + 1} attempts. Please reduce the character limit.`,
    );
  }

  // Double-check against Twitter's absolute maximum
  if (comment.length > 280) {
    throw new Error(
      `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit.`,
    );
  }

  console.log(
    `✅ Comment generated successfully (${comment.length}/${charLimit} chars)${retryCount > 0 ? ` after ${retryCount + 1} attempts` : ""}`,
  );
  return comment;
}

// Generate AI comments for multiple posts in bulk
router.post("/generate-bulk", async (req, res) => {
  try {
    const { postIds, provider, maxLength, additionalPrompt } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        message: "Post IDs array is required",
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

    // Find posts in user session
    const posts = req.userSession.posts.filter((p) => postIds.includes(p.id));

    if (posts.length === 0) {
      return res.status(404).json({
        message: "No posts found",
      });
    }

    // Filter posts that have content and don't already have comments
    const postsToProcess = posts.filter(
      (post) =>
        post.content &&
        post.content.trim() !== "" &&
        post.content !== "Could not extract tweet content" &&
        (!post.comment || post.comment.trim() === ""),
    );
    console.log("posts", posts);

    if (postsToProcess.length === 0) {
      return res.status(400).json({
        message:
          "No posts available for comment generation. Make sure posts have content and don't already have comments.",
      });
    }

    let generatedComments;

    if (provider === "openai") {
      generatedComments = await generateBulkOpenAIComments(
        postsToProcess,
        apiKey,
        maxLength,
        additionalPrompt,
      );
    } else if (provider === "anthropic") {
      generatedComments = await generateBulkAnthropicComments(
        postsToProcess,
        apiKey,
        maxLength,
        additionalPrompt,
      );
    } else if (provider === "gemini") {
      generatedComments = await generateBulkGeminiComments(
        postsToProcess,
        apiKey,
        maxLength,
        additionalPrompt,
      );
    } else {
      return res.status(400).json({
        message: 'Invalid AI provider. Use "openai", "anthropic", or "gemini"',
      });
    }

    // Update posts in session with generated comments
    req.userSession.posts = req.userSession.posts.map((post) => {
      const generated = generatedComments.find((g) => g.postId === post.id);
      if (generated) {
        return {
          ...post,
          comment: generated.comment,
          status: "commented",
          commentGeneratedAt: new Date().toISOString(),
        };
      }
      return post;
    });

    res.json({
      success: true,
      comments: generatedComments,
      message: `Generated ${generatedComments.length} comments using ${provider.toUpperCase()}`,
      stats: {
        total: postIds.length,
        processed: postsToProcess.length,
        generated: generatedComments.length,
        skipped: postIds.length - postsToProcess.length,
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

// Generate bulk comments using OpenAI
async function generateBulkOpenAIComments(
  posts,
  apiKey,
  maxLength = 280,
  additionalPrompt = "",
) {
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  const charLimit = Math.min(maxLength || 280, 280); // Never exceed Twitter's 280 char limit
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : "";

  const postsText = posts
    .map(
      (post, index) =>
        `Post ${index + 1} by ${post.author || post.authorName || "Unknown"}:\n"${post.content}"\n`,
    )
    .join("\n");

  const prompt = `Generate thoughtful, engaging Twitter replies for each of the following posts. Each reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- CRITICAL: Maximum ${charLimit} characters per reply (Twitter limit is 280)
- Include relevant insights or questions
- Avoid generic responses
- Unique and personalized for each post${customInstructions}

Posts to reply to:
${postsText}

Respond with a JSON array where each object has:
- "index": the post number (1, 2, 3...)
- "comment": the generated reply text (MUST be under ${charLimit} characters)

Example format:
[
  {"index": 1, "comment": "Great insights on AI! I'm curious about..."},
  {"index": 2, "comment": "This breakthrough could revolutionize..."}
]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful social media assistant that generates thoughtful, engaging Twitter replies. Always respond with valid JSON format.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const responseText = response.choices[0].message.content.trim();

  try {
    const parsedComments = JSON.parse(responseText);
    const results = posts.map((post, index) => {
      const generated = parsedComments.find((c) => c.index === index + 1);
      const comment = generated ? generated.comment : null;

      if (!comment || comment.trim() === "") {
        throw new Error(`Failed to generate comment for post ${index + 1}`);
      }

      // Check character limit and throw error if exceeded
      if (comment.length > charLimit) {
        throw new Error(
          `Generated comment for post ${index + 1} (${comment.length} chars) exceeds limit of ${charLimit} characters. Please reduce the character limit or add instructions to generate shorter comments.`,
        );
      }

      // Double-check against Twitter's absolute maximum
      if (comment.length > 280) {
        throw new Error(
          `Generated comment for post ${index + 1} (${comment.length} chars) exceeds Twitter's 280 character limit.`,
        );
      }

      return {
        postId: post.id,
        comment: comment,
      };
    });
    return results;
  } catch (parseError) {
    console.error("Failed to parse AI response:", parseError);
    // Throw error instead of fallback
    throw new Error(`AI comment generation failed: ${parseError.message}`);
  }
}

// Generate bulk comments using Anthropic Claude
async function generateBulkAnthropicComments(posts, apiKey) {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const postsText = posts
    .map(
      (post, index) =>
        `Post ${index + 1} by ${post.author || post.authorName || "Unknown"}:\n"${post.content}"\n`,
    )
    .join("\n");

  const prompt = `Generate thoughtful, engaging Twitter replies for each of the following posts. Each reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 2-3 sentences maximum
- Include relevant insights or questions
- Avoid generic responses
- Unique and personalized for each post

Posts to reply to:
${postsText}

Respond with a JSON array where each object has:
- "index": the post number (1, 2, 3...)
- "comment": the generated reply text

Example format:
[
  {"index": 1, "comment": "Great insights on AI! I'm curious about..."},
  {"index": 2, "comment": "This breakthrough could revolutionize..."}
]`;

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText = response.content[0].text.trim();

  try {
    const parsedComments = JSON.parse(responseText);
    const results = posts.map((post, index) => {
      const generated = parsedComments.find((c) => c.index === index + 1);
      const comment = generated ? generated.comment : null;

      if (!comment || comment.trim() === "") {
        throw new Error(`Failed to generate comment for post ${index + 1}`);
      }

      // Check character limit and throw error if exceeded
      if (comment.length > charLimit) {
        throw new Error(
          `Generated comment for post ${index + 1} (${comment.length} chars) exceeds limit of ${charLimit} characters. Please reduce the character limit or add instructions to generate shorter comments.`,
        );
      }

      // Double-check against Twitter's absolute maximum
      if (comment.length > 280) {
        throw new Error(
          `Generated comment for post ${index + 1} (${comment.length} chars) exceeds Twitter's 280 character limit.`,
        );
      }

      return {
        postId: post.id,
        comment: comment,
      };
    });
    return results;
  } catch (parseError) {
    console.error("Failed to parse AI response:", parseError);
    // Throw error instead of fallback
    throw new Error(`AI comment generation failed: ${parseError.message}`);
  }
}

// Generate bulk comments using Google Gemini
async function generateBulkGeminiComments(
  posts,
  apiKey,
  maxLength = 280,
  additionalPrompt = "",
) {
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });

  const charLimit = Math.min(maxLength || 280, 280); // Never exceed Twitter's 280 char limit
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : "";

  const postsText = posts
    .map(
      (post, index) =>
        `Post ${index + 1} by ${post.author || post.authorName || "Unknown"}:\n"${post.content}"\n`,
    )
    .join("\n");

  const prompt = `Generate thoughtful, engaging Twitter replies for each of the following posts. Each reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 🚨 CRITICAL: MUST be under ${charLimit} characters total (count carefully!)
- Include relevant insights or questions
- Avoid generic responses
- Unique and personalized for each post${customInstructions}

Posts to reply to:
${postsText}

Respond with a JSON array where each object has:
- "index": the post number (1, 2, 3...)
- "comment": the generated reply text (MUST be under ${charLimit} characters)

Example format:
[
  {"index": 1, "comment": "Great insights on AI! I'm curious about..."},
  {"index": 2, "comment": "This breakthrough could revolutionize..."}
]`;

  try {
    console.log("Generating Gemini comments...", { ai, apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const responseText = response.text.trim();

    // Extract JSON from the response (Gemini might include markdown formatting)
    let jsonStr = responseText;
    if (responseText.includes("```json")) {
      jsonStr = responseText.split("```json")[1].split("```")[0].trim();
    } else if (responseText.includes("```")) {
      jsonStr = responseText.split("```")[1].split("```")[0].trim();
    }

    const parsedComments = JSON.parse(jsonStr);
    const results = posts.map((post, index) => {
      const generated = parsedComments.find((c) => c.index === index + 1);
      let comment = generated ? generated.comment : null;

      if (!comment || comment.trim() === "") {
        throw new Error(`Failed to generate comment for post ${index + 1}`);
      }

      // Check character limit and throw error if exceeded
      // if (comment.length > charLimit) {
      //   throw new Error(
      //     `Generated comment for post ${index + 1} (${comment.length} chars) exceeds limit of ${charLimit} characters. Please reduce the character limit or add instructions to generate shorter comments.`,
      //   );
      // }
      //
      // // Double-check against Twitter's absolute maximum
      // if (comment.length > 280) {
      //   throw new Error(
      //     `Generated comment for post ${index + 1} (${comment.length} chars) exceeds Twitter's 280 character limit.`,
      //   );
      // }

      return {
        postId: post.id,
        comment: comment,
      };
    });
    return results;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    // Throw error instead of fallback
    throw new Error(`AI comment generation failed: ${error.message}`);
  }
}

export default router;
