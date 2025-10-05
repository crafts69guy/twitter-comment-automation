import express from 'express';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { generateBulkComments } from '../services/aiService.js';

const router = express.Router();

// Extract sheet ID from Google Sheets URL
function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Extract tweet ID from Twitter/X URL
function extractTweetId(url) {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

// Convert cookies from JSON array format to cookie string
function parseCookies(cookiesInput) {
  if (!cookiesInput) return { cookieString: '', ct0: '' };

  let cookieArray = [];

  // Check if it's JSON format (from browser extension)
  try {
    const parsed = JSON.parse(cookiesInput);
    if (parsed.cookies && Array.isArray(parsed.cookies)) {
      cookieArray = parsed.cookies;
    }
  } catch (e) {
    // Not JSON, treat as cookie string
    const cookieObj = {};
    cookiesInput.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        cookieObj[key] = value;
      }
    });
    return { cookieString: cookiesInput, ct0: cookieObj.ct0 || '' };
  }

  // Convert JSON array to cookie string
  const cookieString = cookieArray.map(c => `${c.name}=${c.value}`).join('; ');

  // Extract ct0 for CSRF token
  const ct0Cookie = cookieArray.find(c => c.name === 'ct0');
  const ct0 = ct0Cookie ? ct0Cookie.value : '';

  return { cookieString, ct0 };
}

// Fetch tweet data from Twitter API
async function fetchTweetData(tweetId, cookies, bearerToken) {
  const variables = {
    tweetId: tweetId,
    includePromotedContent: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withCommunity: true,
  };

  const features = {
    creator_subscriptions_tweet_preview_api_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    payments_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  };

  const fieldToggles = {
    withArticleRichContentState: true,
    withArticlePlainText: false,
  };

  // Parse cookies (handles both JSON and string formats)
  const { cookieString, ct0 } = parseCookies(cookies);
  const csrfToken = ct0;

  const url = `https://x.com/i/api/graphql/URPP6YZ5eDCjdVMSREn4gg/TweetResultByRestId?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}&fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`;

  try {
    const response = await axios.get(url, {
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        authorization: bearerToken,
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        dnt: '1',
        pragma: 'no-cache',
        'sec-ch-ua': '"Not=A?Brand";v="24", "Chromium";v="140"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'x-csrf-token': csrfToken,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
        Cookie: cookieString,
      },
    });

    // Extract tweet text from response
    const tweetResult =
      response.data?.data?.tweetResult?.result || response.data?.data?.tweet?.result;

    if (!tweetResult) {
      return { success: false, error: 'Tweet not found' };
    }

    const legacy = tweetResult.legacy || tweetResult.tweet?.legacy;
    const tweetText =
      tweetResult?.note_tweet?.note_tweet_results?.result?.text || legacy?.full_text || '';
    const user = tweetResult.core?.user_results?.result?.legacy;

    return {
      success: true,
      text: tweetText,
      author: user?.screen_name || 'unknown',
      authorName: user?.name || 'Unknown User',
    };
  } catch (error) {
    console.error(`Error fetching tweet ${tweetId}:`, error.message);
    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.message || error.message,
    };
  }
}

// Combined route: Fetch from Google Sheets + Twitter API + Generate AI comments
router.post('/fetch-and-generate', async (req, res) => {
  try {
    const { sheetUrl, cookies, bearerToken, aiProvider, maxLength, additionalPrompt } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({
        message: 'Google Sheet URL is required',
      });
    }

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      return res.status(400).json({
        message: 'Invalid Google Sheet URL format',
      });
    }

    // Step 1: Fetch posts from Google Sheets
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './google-credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A:B', // Column A for URLs, Column B for content (optional)
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({
        success: true,
        posts: [],
        message: 'No data found in the spreadsheet',
      });
    }

    // Skip header row and process data
    const dataRows = rows.slice(1);
    const initialPosts = dataRows
      .map(row => ({
        id: uuidv4(),
        url: row[0] || '',
        content: row[1] || '', // Optional pre-filled content
        comment: '',
        status: 'pending',
      }))
      .filter(post => post.url && (post.url.includes('twitter.com') || post.url.includes('x.com')));

    if (initialPosts.length === 0) {
      return res.json({
        success: true,
        posts: [],
        message: 'No valid Twitter/X URLs found in the spreadsheet',
      });
    }

    // Step 2: Fetch tweet data from Twitter API in parallel
    const tweetFetchPromises = initialPosts.map(async post => {
      const tweetId = extractTweetId(post.url);
      if (!tweetId) {
        return {
          ...post,
          twitterApiError: 'Could not extract tweet ID from URL',
        };
      }

      const tweetData = await fetchTweetData(tweetId, cookies, bearerToken);

      if (tweetData.success) {
        return {
          ...post,
          content: tweetData.text,
          author: tweetData.author,
          authorName: tweetData.authorName,
          tweetId: tweetId,
        };
      } else {
        return {
          ...post,
          tweetId: tweetId,
          twitterApiError: tweetData.error,
        };
      }
    });

    // Wait for all parallel requests to complete
    const postsWithTwitterData = await Promise.all(tweetFetchPromises);

    // Store posts in session temporarily
    req.userSession.posts = postsWithTwitterData;

    // Step 3: Generate AI comments using shared AI service
    let postsWithComments = postsWithTwitterData;
    if (aiProvider) {
      // Get API key from environment
      const apiKey =
        aiProvider === 'openai'
          ? process.env.OPENAI_API_KEY
          : aiProvider === 'anthropic'
            ? process.env.ANTHROPIC_API_KEY
            : aiProvider === 'gemini'
              ? process.env.GEMINI_API_KEY
              : null;

      if (!apiKey) {
        console.warn(`${aiProvider.toUpperCase()} API key not configured, skipping AI generation`);
      } else {
        // Filter posts that have content and no errors
        const postsToGenerate = postsWithTwitterData.filter(p => !p.twitterApiError && p.content);

        if (postsToGenerate.length > 0) {
          try {
            // Generate comments in parallel using shared AI service
            const results = await generateBulkComments(
              postsToGenerate,
              aiProvider,
              apiKey,
              maxLength || 280,
              additionalPrompt || '',
            );

            // Update posts with generated comments
            postsWithComments = postsWithTwitterData.map(post => {
              const result = results.find(r => r.postId === post.id);
              if (result && result.success) {
                return {
                  ...post,
                  comment: result.comment,
                  status: 'commented',
                };
              }
              return post;
            });
          } catch (aiError) {
            console.error('AI generation error:', aiError.message);
            // Continue without AI comments if generation fails
          }
        }
      }
    }

    // Update session with posts including generated comments
    req.userSession.posts = postsWithComments;

    // Calculate stats
    const successCount = postsWithComments.filter(p => !p.twitterApiError).length;
    const errorCount = postsWithComments.filter(p => p.twitterApiError).length;
    const commentsGenerated = postsWithComments.filter(
      p => p.comment && p.comment.trim() !== '',
    ).length;

    let message = `Fetched ${initialPosts.length} posts from Google Sheets. Twitter API: ${successCount} successful, ${errorCount} failed.`;
    if (aiProvider) {
      message += ` AI Comments: ${commentsGenerated} generated.`;
    }

    res.json({
      success: true,
      posts: postsWithComments,
      message,
      stats: {
        total: postsWithComments.length,
        twitterApiSuccess: successCount,
        twitterApiErrors: errorCount,
        commentsGenerated: aiProvider ? commentsGenerated : 0,
      },
    });
  } catch (error) {
    console.error('Automation error:', error);
    res.status(500).json({
      message: 'Failed to complete automation',
      error: error.message,
    });
  }
});

export default router;
