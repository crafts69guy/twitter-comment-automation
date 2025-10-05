import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

// Helper function to build prompt with retry instructions
function buildPrompt(post, charLimit, customInstructions, retryCount) {
  const retryInstructions =
    retryCount > 0
      ? `\n- EXTREMELY IMPORTANT: Keep response very brief and concise\n- Use shorter sentences and fewer words\n- Aim for ${Math.max(charLimit - 20, 20)} characters or less`
      : '';

  return `Generate a thoughtful, engaging Twitter reply to this post. The reply should be:
- Professional and respectful
- Add value to the conversation
- Be authentic and human-like
- 🚨 CRITICAL: MUST be under ${charLimit} characters total (count carefully!)
- Include relevant insights or questions
- Avoid generic responses${customInstructions}${retryInstructions}

Original post by ${post.author || post.authorName || 'Unknown'}:
"${post.content}"

Generate only the reply text, no quotes, no emoji or extra formatting. MUST be under ${charLimit} characters:`;
}

// Helper function to validate and retry comment
async function validateComment(comment, charLimit, retryCount, retryFn) {
  if (comment.length > charLimit && retryCount < 2) {
    console.log(
      `⚠️ Comment too long (${comment.length} chars), retrying attempt ${retryCount + 1}/2...`,
    );
    return await retryFn(retryCount + 1);
  }

  if (comment.length > charLimit) {
    throw new Error(
      `Generated comment (${comment.length} chars) exceeds limit of ${charLimit} characters after ${retryCount + 1} attempts.`,
    );
  }

  if (comment.length > 280) {
    throw new Error(
      `Generated comment (${comment.length} chars) exceeds Twitter's 280 character limit.`,
    );
  }

  console.log(
    `✅ Comment generated successfully (${comment.length}/${charLimit} chars)${retryCount > 0 ? ` after ${retryCount + 1} attempts` : ''}`,
  );

  return comment;
}

// Generate comment using OpenAI
export async function generateOpenAIComment(
  post,
  apiKey,
  maxLength = 280,
  additionalPrompt = '',
  retryCount = 0,
) {
  const openai = new OpenAI({ apiKey });
  const charLimit = Math.min(maxLength || 280, 280);
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : '';
  const prompt = buildPrompt(post, charLimit, customInstructions, retryCount);

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content:
          'You are a helpful social media assistant that generates thoughtful, engaging Twitter replies. Be professional, authentic, and add value to conversations. NEVER exceed the character limit. Be extremely concise.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: Math.ceil(charLimit * 1.5),
    temperature: 0.7,
  });

  const comment = response.choices[0].message.content.trim();

  return validateComment(comment, charLimit, retryCount, newRetryCount =>
    generateOpenAIComment(post, apiKey, maxLength, additionalPrompt, newRetryCount),
  );
}

// Generate comment using Anthropic Claude
export async function generateAnthropicComment(
  post,
  apiKey,
  maxLength = 280,
  additionalPrompt = '',
  retryCount = 0,
) {
  const anthropic = new Anthropic({ apiKey });
  const charLimit = Math.min(maxLength || 280, 280);
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : '';
  const prompt = buildPrompt(post, charLimit, customInstructions, retryCount);

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: Math.ceil(charLimit * 2),
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const comment = response.content[0].text.trim();

  return validateComment(comment, charLimit, retryCount, newRetryCount =>
    generateAnthropicComment(post, apiKey, maxLength, additionalPrompt, newRetryCount),
  );
}

// Generate comment using Google Gemini
export async function generateGeminiComment(
  post,
  apiKey,
  maxLength = 280,
  additionalPrompt = '',
  retryCount = 0,
) {
  const ai = new GoogleGenAI({ apiKey });
  const charLimit = Math.min(maxLength || 280, 280);
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : '';
  const prompt = buildPrompt(post, charLimit, customInstructions, retryCount);

  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const comment = result.text.trim();

  return validateComment(comment, charLimit, retryCount, newRetryCount =>
    generateGeminiComment(post, apiKey, maxLength, additionalPrompt, newRetryCount),
  );
}

// Main function to generate comment based on provider
export async function generateComment(post, provider, apiKey, maxLength, additionalPrompt) {
  if (!post.content || post.content.trim() === '') {
    throw new Error('Post content is empty');
  }

  switch (provider) {
    case 'openai':
      return await generateOpenAIComment(post, apiKey, maxLength, additionalPrompt);
    case 'anthropic':
      return await generateAnthropicComment(post, apiKey, maxLength, additionalPrompt);
    case 'gemini':
      return await generateGeminiComment(post, apiKey, maxLength, additionalPrompt);
    default:
      throw new Error(`Invalid AI provider: ${provider}`);
  }
}

// Bulk generate comments for multiple posts
export async function generateBulkComments(posts, provider, apiKey, maxLength, additionalPrompt) {
  const results = await Promise.all(
    posts.map(async post => {
      try {
        const comment = await generateComment(post, provider, apiKey, maxLength, additionalPrompt);
        return {
          postId: post.id,
          comment,
          success: true,
        };
      } catch (error) {
        console.error(`Error generating comment for post ${post.id}:`, error.message);
        return {
          postId: post.id,
          error: error.message,
          success: false,
        };
      }
    }),
  );

  return results;
}
