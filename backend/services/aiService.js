import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { buildBulkPrompt, buildPrompt } from '../helpers/prompt.js';
import { validateBulkComments, validateComment } from '../helpers/validate.js';

// Client instances cache to avoid recreating on every call
const clientCache = {
  openai: new Map(),
  anthropic: new Map(),
  gemini: new Map(),
};

// Helper to get or create AI client instance
function getAIClient(provider, apiKey) {
  const cache = clientCache[provider];

  if (!cache) {
    throw new Error(`Invalid AI provider: ${provider}`);
  }

  // Return cached instance if exists
  if (cache.has(apiKey)) {
    return cache.get(apiKey);
  }

  // Create new instance and cache it
  let client;
  switch (provider) {
    case 'openai':
      client = new OpenAI({ apiKey });
      break;
    case 'anthropic':
      client = new Anthropic({ apiKey });
      break;
    case 'gemini':
      client = new GoogleGenAI({ apiKey });
      break;
    default:
      throw new Error(`Invalid AI provider: ${provider}`);
  }

  cache.set(apiKey, client);
  return client;
}

// Generate comment using OpenAI
export async function generateOpenAIComment(
  post,
  apiKey,
  maxLength = 80,
  additionalPrompt = '',
  retryCount = 0,
) {
  const openai = getAIClient('openai', apiKey);
  const charLimit = Math.min(maxLength || 80, 80);
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
  maxLength = 80,
  additionalPrompt = '',
  retryCount = 0,
) {
  const anthropic = getAIClient('anthropic', apiKey);
  const charLimit = Math.min(maxLength || 80, 80);
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
  maxLength = 80,
  additionalPrompt = '',
  retryCount = 0,
) {
  const ai = getAIClient('gemini', apiKey);
  const charLimit = Math.min(maxLength || 80, 80);
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

// Bulk generate comments for multiple posts - OPTIMIZED SINGLE API CALL
export async function generateBulkComments(
  posts,
  provider,
  apiKey,
  maxLength,
  additionalPrompt,
  retryCount = 0,
) {
  if (!posts || posts.length === 0) {
    return [];
  }

  const charLimit = Math.min(maxLength || 80, 80);
  const customInstructions = additionalPrompt ? `\n- ${additionalPrompt}` : '';

  // Build a single prompt for all posts using helper
  const bulkPrompt = buildBulkPrompt(posts, charLimit, customInstructions);

  try {
    let responseText;

    // Call the appropriate AI provider with the bulk prompt using cached client
    switch (provider) {
      case 'openai': {
        const openai = getAIClient('openai', apiKey);
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful social media assistant that generates thoughtful, engaging Twitter replies. Be professional, authentic, and add value to conversations. NEVER exceed the character limit. Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: bulkPrompt,
            },
          ],
          max_tokens: Math.ceil(charLimit * posts.length * 2),
          temperature: 0.7,
        });
        responseText = response.choices[0].message.content.trim();
        break;
      }

      case 'anthropic': {
        const anthropic = getAIClient('anthropic', apiKey);
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: Math.ceil(charLimit * posts.length * 2),
          messages: [
            {
              role: 'user',
              content: bulkPrompt,
            },
          ],
        });
        responseText = response.content[0].text.trim();
        break;
      }

      case 'gemini': {
        const ai = getAIClient('gemini', apiKey);
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: bulkPrompt,
        });
        responseText = result.text.trim();
        break;
      }

      default:
        throw new Error(`Invalid AI provider: ${provider}`);
    }

    console.log('responseText', responseText);
    // Parse the JSON response
    // Remove markdown code blocks if present
    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    let parsedComments;
    try {
      parsedComments = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', responseText);
      throw new Error(`AI response was not valid JSON: ${parseError.message}`);
    }

    // Validate and map results using helper
    const results = validateBulkComments(parsedComments, posts, charLimit);
    console.log('results', results);

    return results;
  } catch (error) {
    console.error('Bulk AI generation error:', error.message);

    // Retry with delay if under retry limit
    if (retryCount < 2) {
      const delayMs = (retryCount + 1) * 2000; // 2s, 4s
      console.log(
        `⚠️ Bulk generation failed, retrying in ${delayMs / 1000}s (attempt ${retryCount + 1}/2)...`,
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));

      return generateBulkComments(
        posts,
        provider,
        apiKey,
        maxLength,
        additionalPrompt,
        retryCount + 1,
      );
    }

    // After all retries exhausted, throw error
    console.error('❌ Bulk generation failed after all retries');
    throw error;
  }
}
