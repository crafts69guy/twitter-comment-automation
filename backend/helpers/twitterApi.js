import axios from 'axios';

/**
 * Extract tweet ID from Twitter/X URL
 */
export function extractTweetId(url) {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Parse cookies from JSON or string format
 */
export function parseCookies(cookiesInput) {
  if (!cookiesInput) return { cookieString: '', ct0: '' };

  let cookieArray = [];

  // Check if it's JSON format
  try {
    const parsed = JSON.parse(cookiesInput);

    // Format 1: {"cookies": [{name: "x", value: "y"}]}
    if (parsed.cookies && Array.isArray(parsed.cookies)) {
      cookieArray = parsed.cookies;
    }
    // Format 2: {"auth_token": "xxx", "ct0": "yyy"} (from playwrightService)
    else if (typeof parsed === 'object') {
      // Convert object to cookie string
      const cookieString = Object.entries(parsed)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      const ct0 = parsed.ct0 || '';
      console.log('📝 Parsed cookies from object format:', Object.keys(parsed));
      return { cookieString, ct0 };
    }
  } catch (e) {
    // Not JSON, treat as cookie string format: "auth_token=xxx; ct0=yyy"
    const cookieObj = {};
    cookiesInput.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        cookieObj[key] = value;
      }
    });
    console.log('📝 Parsed cookies from string format:', Object.keys(cookieObj));
    return { cookieString: cookiesInput, ct0: cookieObj.ct0 || '' };
  }

  // Convert JSON array to cookie string (Format 1)
  const cookieString = cookieArray.map(c => `${c.name}=${c.value}`).join('; ');

  // Extract ct0 for CSRF token
  const ct0Cookie = cookieArray.find(c => c.name === 'ct0');
  const ct0 = ct0Cookie ? ct0Cookie.value : '';

  console.log(
    '📝 Parsed cookies from array format:',
    cookieArray.map(c => c.name),
  );
  return { cookieString, ct0 };
}

/**
 * Fetch tweet data from Twitter GraphQL API
 * @param {string} tweetId - Tweet ID to fetch
 * @param {string} cookies - Cookies in JSON format
 * @param {string} bearerToken - Bearer token for authentication
 * @param {number} retries - Number of retries on failure (default: 2)
 */
export async function fetchTweetData(tweetId, cookies, bearerToken, retries = 2) {
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

  console.log('🔐 Twitter API Request Debug:', {
    tweetId,
    hasBearerToken: !!bearerToken,
    bearerTokenFormat: bearerToken?.startsWith('Bearer ') ? 'Valid' : 'Missing "Bearer " prefix',
    bearerTokenLength: bearerToken?.length || 0,
    hasCsrfToken: !!csrfToken,
    cookieStringLength: cookieString?.length || 0,
  });

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

    // ✅ DETECT EXPIRED CREDENTIALS
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      console.error('❌ Twitter API: Credentials expired (401/403)');
      return {
        success: false,
        error: 'CREDENTIALS_EXPIRED',
        needsReauth: true,
        originalError: error.response?.data?.errors?.[0]?.message || error.message,
      };
    }

    // Retry on rate limit (429) or server errors (500, 502, 503, 504)
    if (retries > 0 && [429, 500, 502, 503, 504].includes(status)) {
      const delay = status === 429 ? 5000 : 2000; // 5s for rate limit, 2s for server errors
      console.log(`⚠️  Retrying after ${delay}ms (${retries} retries left)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchTweetData(tweetId, cookies, bearerToken, retries - 1);
    }

    return {
      success: false,
      error: error.response?.data?.errors?.[0]?.message || error.message,
    };
  }
}

/**
 * Fetch tweet content for multiple links (batch)
 * Optional: Only fetches if Twitter API credentials provided
 * If credentials not provided, returns empty results (links will use content from Google Sheets)
 */
export async function fetchTweetContentBatch(links, cookies, bearerToken) {
  const results = [];

  // Check if Twitter API credentials available
  const hasTwitterApi = cookies && bearerToken;

  if (!hasTwitterApi) {
    console.log('[Twitter API] No credentials provided - skipping tweet content fetch');
    console.log('[Twitter API] Will use content from Google Sheets Column B if available');
    // Return empty results - links will keep their existing content
    return results;
  }

  console.log('[Twitter API] Fetching tweet content via Twitter API...');

  for (const link of links) {
    const tweetId = extractTweetId(link.url);

    if (!tweetId) {
      results.push({
        linkId: link.id,
        success: false,
        error: 'Invalid Twitter URL',
      });
      continue;
    }

    const tweetData = await fetchTweetData(tweetId, cookies, bearerToken);

    if (tweetData.success) {
      results.push({
        linkId: link.id,
        success: true,
        content: tweetData.text,
        author: tweetData.author,
        authorName: tweetData.authorName,
      });
    } else {
      results.push({
        linkId: link.id,
        success: false,
        error: tweetData.error,
        needsReauth: tweetData.needsReauth || false, // ✅ Pass reauth flag
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
