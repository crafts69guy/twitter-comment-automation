import express from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

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
        : process.env.ANTHROPIC_API_KEY;

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
    } else {
      return res.status(400).json({
        message: 'Invalid AI provider. Use "openai" or "anthropic"',
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

export default router;
