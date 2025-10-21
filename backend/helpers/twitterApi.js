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

/**
 * Fetch tweet data from Twitter GraphQL API
 */
export async function fetchTweetData(tweetId, cookies, bearerToken) {
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

/**
 * Fetch tweet content for multiple links (batch)
 * Requires Twitter API credentials - no fallback to scraping
 */
export async function fetchTweetContentBatch(links, cookies, bearerToken) {
  const results = [];

  // Check if Twitter API credentials available
  const hasTwitterApi = cookies && bearerToken;

  if (!hasTwitterApi) {
    console.error('[Twitter API] Credentials required but not provided');
    throw new Error('Twitter API credentials (cookies and bearerToken) are required');
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
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
