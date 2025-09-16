import express from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

// Generate AI comment for a specific post
router.post("/generate", async (req, res) => {
  try {
    const { postId, provider } = req.body;

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
      generatedComment = await generateOpenAIComment(post, apiKey);
    } else if (provider === "anthropic") {
      generatedComment = await generateAnthropicComment(post, apiKey);
    } else if (provider === "gemini") {
      generatedComment = await generateGeminiComment(post, apiKey);
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
async function generateOpenAIComment(post, apiKey) {
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  const prompt = `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 2-3 sentences maximum
- Include relevant insights or questions
- Avoid generic responses

Original post by ${post.author || "Unknown"}:
"${post.content}"

Generate only the reply text, no quotes or extra formatting:`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful social media assistant that generates thoughtful, engaging Twitter replies. Be professional, authentic, and add value to conversations.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 280,
    temperature: 0.7,
  });

  return response.choices[0].message.content.trim();
}

// Generate comment using Anthropic Claude
async function generateAnthropicComment(post, apiKey) {
  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const prompt = `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 2-3 sentences maximum
- Include relevant insights or questions
- Avoid generic responses

Original post by ${post.author || "Unknown"}:
"${post.content}"

Generate only the reply text, no quotes or extra formatting:`;

  const response = await anthropic.messages.create({
    model: "claude-3-sonnet-20240229",
    max_tokens: 280,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return response.content[0].text.trim();
}

// Generate comment using Google Gemini
async function generateGeminiComment(post, apiKey) {
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });

  const prompt = `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 2-3 sentences maximum
- Include relevant insights or questions
- Avoid generic responses

Original post by ${post.author || post.authorName || "Unknown"}:
"${post.content}"

Generate only the reply text, no quotes or extra formatting:`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text.trim();
}

// Demo AI generation endpoint
// router.post("/generate-demo", async (req, res) => {
//   try {
//     const { postId } = req.body;
//
//     if (!postId) {
//       return res.status(400).json({
//         message: "Post ID is required",
//       });
//     }
//
//     // Find the post in user session
//     const post = req.userSession.posts.find((p) => p.id === postId);
//     if (!post) {
//       return res.status(404).json({
//         message: "Post not found",
//       });
//     }
//
//     // Simulate AI processing delay
//     await new Promise((resolve) => setTimeout(resolve, 1500));
//
//     // Generate contextual demo comments based on post content
//     const demoComments = {
//       ai: [
//         "Fascinating insights on AI development! The potential applications in healthcare and education are particularly exciting. What challenges do you see in ensuring ethical AI deployment?",
//         "This AI breakthrough could revolutionize how we approach complex problem-solving. The implications for scientific research are immense. How do you envision this scaling globally?",
//         "The progress in neural networks is truly remarkable! This technology has the potential to augment human capabilities in unprecedented ways. What's your take on AI-human collaboration?",
//       ],
//       quantum: [
//         "Quantum computing breakthroughs like this bring us closer to solving previously impossible computational challenges. The implications for cryptography and drug discovery are game-changing!",
//         "This quantum milestone represents years of dedicated research paying off. The potential applications in optimization and simulation are incredibly exciting. What's next on the roadmap?",
//         "Amazing progress in quantum computing! This could accelerate breakthroughs in materials science and financial modeling. How do you see this impacting everyday technology?",
//       ],
//       cloud: [
//         "Azure's AI capabilities are truly empowering developers to build more intelligent applications. The democratization of AI tools is accelerating innovation across industries!",
//         "This cloud-first approach to AI is making advanced technologies accessible to companies of all sizes. The potential for startups to compete with tech giants is incredible!",
//         "The integration of AI into cloud platforms is transforming how we build and deploy applications. What trends do you see emerging in cloud-native AI development?",
//       ],
//       space: [
//         "Another successful mission pushing the boundaries of human exploration! Space technology continues to inspire and drive innovation here on Earth. What's the next frontier?",
//         "The progress in commercial spaceflight is opening up incredible possibilities for scientific research and exploration. The future of humanity among the stars looks brighter than ever!",
//         "These space achievements remind us that human ingenuity knows no bounds. The technologies developed for space exploration often find amazing applications on Earth too!",
//       ],
//       privacy: [
//         "Privacy-first innovation is exactly what the tech industry needs. Balancing technological advancement with user protection sets a great example for the entire sector!",
//         "This commitment to user privacy while advancing technology is commendable. It proves that innovation and privacy protection can go hand in hand. How do you see this influencing industry standards?",
//         "The focus on privacy and security in new technologies is crucial for building user trust. This approach could reshape how the entire tech industry handles user data!",
//       ],
//     };
//
//     // Select appropriate comment category based on post content
//     let selectedCategory = "ai"; // default
//     const content = post.content.toLowerCase();
//
//     if (content.includes("quantum")) selectedCategory = "quantum";
//     else if (content.includes("azure") || content.includes("cloud"))
//       selectedCategory = "cloud";
//     else if (content.includes("space") || content.includes("mission"))
//       selectedCategory = "space";
//     else if (content.includes("privacy") || content.includes("security"))
//       selectedCategory = "privacy";
//
//     const categoryComments = demoComments[selectedCategory];
//     const generatedComment =
//       categoryComments[Math.floor(Math.random() * categoryComments.length)];
//
//     // Update the post in session
//     const postIndex = req.userSession.posts.findIndex((p) => p.id === postId);
//     req.userSession.posts[postIndex] = {
//       ...req.userSession.posts[postIndex],
//       comment: generatedComment,
//       status: "commented",
//     };
//
//     res.json({
//       success: true,
//       comment: generatedComment,
//       message: "Demo comment generated successfully",
//     });
//   } catch (error) {
//     console.error("Demo AI generation error:", error);
//     res.status(500).json({
//       message: "Failed to generate demo comment",
//       error: error.message,
//     });
//   }
// });

// Generate AI comments for multiple posts in bulk
router.post("/generate-bulk", async (req, res) => {
  try {
    const { postIds, provider } = req.body;

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
      );
    } else if (provider === "anthropic") {
      generatedComments = await generateBulkAnthropicComments(
        postsToProcess,
        apiKey,
      );
    } else if (provider === "gemini") {
      generatedComments = await generateBulkGeminiComments(
        postsToProcess,
        apiKey,
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
async function generateBulkOpenAIComments(posts, apiKey) {
  const openai = new OpenAI({
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
    return posts.map((post, index) => {
      const generated = parsedComments.find((c) => c.index === index + 1);
      return {
        postId: post.id,
        comment: generated
          ? generated.comment
          : `Interesting perspective! Thanks for sharing your thoughts on this topic.`,
      };
    });
  } catch (parseError) {
    console.error("Failed to parse AI response:", parseError);
    // Fallback: generate individual comments
    return posts.map((post) => ({
      postId: post.id,
      comment: `Great post! This is really insightful and adds valuable perspective to the conversation.`,
    }));
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
    return posts.map((post, index) => {
      const generated = parsedComments.find((c) => c.index === index + 1);
      return {
        postId: post.id,
        comment: generated
          ? generated.comment
          : `Interesting perspective! Thanks for sharing your thoughts on this topic.`,
      };
    });
  } catch (parseError) {
    console.error("Failed to parse AI response:", parseError);
    // Fallback: generate individual comments
    return posts.map((post) => ({
      postId: post.id,
      comment: `Great post! This is really insightful and adds valuable perspective to the conversation.`,
    }));
  }
}

// Generate bulk comments using Google Gemini
async function generateBulkGeminiComments(posts, apiKey) {
  const ai = new GoogleGenAI({
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
    return posts.map((post, index) => {
      const generated = parsedComments.find((c) => c.index === index + 1);
      return {
        postId: post.id,
        comment: generated
          ? generated.comment
          : `Great insights! This adds valuable perspective to the discussion.`,
      };
    });
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    // Fallback: generate individual comments
    const fallbackPromises = posts.map(async (post) => {
      try {
        const individualPrompt = `Generate a thoughtful Twitter reply (2-3 sentences max) to: "${post.content}"`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: individualPrompt,
        });
        return {
          postId: post.id,
          comment: response.text.trim(),
        };
      } catch (err) {
        return {
          postId: post.id,
          comment: `Interesting perspective! Thanks for sharing this insight.`,
        };
      }
    });

    return Promise.all(fallbackPromises);
  }
}

export default router;
