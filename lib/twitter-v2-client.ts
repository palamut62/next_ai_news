import { TwitterApi } from 'twitter-api-v2'
import { getTwitterCharacterCount, estimateTotalTweetLength } from './utils'
import { getActiveTwitterApiKey, decryptApiKey, recordTwitterKeyUsage } from './firebase-api-keys'

export async function postTextTweetV2(
  tweetText: string,
  sourceUrl?: string,
  hashtags?: string[]
) {
  console.log("🚀 postTextTweetV2 called with:", { tweetText: tweetText?.substring(0, 50), sourceUrl, hashtags })

  if (!tweetText || !tweetText.trim()) {
    console.error("❌ Tweet text is empty")
    return { success: false, error: "Tweet metni boş olamaz" };
  }

  let text = tweetText.trim()
  const MAX_LENGTH = 280
  console.log(`✏️ Processing tweet: ${text.substring(0, 50)}...`)

  // Use provided hashtags or generate them if needed
  let finalHashtags = hashtags || []

  // Prepare source URL suffix
  const rawUrl = sourceUrl && sourceUrl.trim() ? sourceUrl.trim() : ''

  // Check if URL is already in the text
  const urlAlreadyIncluded = rawUrl && text.includes(rawUrl)

  // Estimate total length with URL and hashtags
  let totalLength = estimateTotalTweetLength(text, !urlAlreadyIncluded ? rawUrl : undefined, finalHashtags)

  // If over limit, progressively reduce hashtags
  if (totalLength > MAX_LENGTH && finalHashtags.length > 0) {
    finalHashtags = finalHashtags.slice(0, 2)
    totalLength = estimateTotalTweetLength(text, !urlAlreadyIncluded ? rawUrl : undefined, finalHashtags)
  }

  if (totalLength > MAX_LENGTH && finalHashtags.length > 0) {
    finalHashtags = finalHashtags.slice(0, 1)
    totalLength = estimateTotalTweetLength(text, !urlAlreadyIncluded ? rawUrl : undefined, finalHashtags)
  }

  // If still over limit, truncate the tweet content itself
  if (totalLength > MAX_LENGTH) {
    const reserved = (rawUrl && !urlAlreadyIncluded ? getTwitterCharacterCount(rawUrl) + 2 : 0) +
                     (finalHashtags.length > 0 ? 1 + finalHashtags.reduce((sum, tag) => sum + getTwitterCharacterCount(tag) + 1, 0) : 0)
    const maxContent = MAX_LENGTH - reserved - 3 // -3 for ...

    if (maxContent > 0) {
      // Truncate using proper character counting
      let truncated = ""
      let count = 0
      try {
        // @ts-ignore
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          // @ts-ignore
          const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
          // @ts-ignore
          for (const segment of segmenter.segment(text)) {
            count += 1
            if (count > maxContent) break
            truncated += segment.segment
          }
        } else {
          truncated = text.substring(0, maxContent)
        }
      } catch (e) {
        truncated = text.substring(0, maxContent)
      }
      text = truncated + "..."
    } else {
      text = "..."
    }
  }
  // Get Twitter credentials from Firebase
  let BEARER_TOKEN: string | null = null;
  let API_KEY: string | null = null;
  let API_SECRET: string | null = null;
  let ACCESS_TOKEN: string | null = null;
  let ACCESS_TOKEN_SECRET: string | null = null;
  let TWITTER_KEY_ID: string | null = null;

  try {
    const twitterKey = await getActiveTwitterApiKey();

    if (twitterKey) {
      API_KEY = decryptApiKey(twitterKey.api_key);
      API_SECRET = decryptApiKey(twitterKey.api_secret);
      ACCESS_TOKEN = decryptApiKey(twitterKey.access_token);
      ACCESS_TOKEN_SECRET = decryptApiKey(twitterKey.access_token_secret);
      BEARER_TOKEN = decryptApiKey(twitterKey.bearer_token);
      TWITTER_KEY_ID = twitterKey.id;
      console.log(`✅ Using Twitter API key from Firebase: ${twitterKey.key_name}`);
    } else {
      // Fallback to environment variables
      BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || null;
      API_KEY = process.env.TWITTER_API_KEY || null;
      API_SECRET = process.env.TWITTER_API_SECRET || null;
      ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || null;
      ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || null;
      console.warn(`⚠️ No active Twitter API key in Firebase, falling back to environment variables`);
    }
  } catch (error) {
    console.error('❌ Failed to get Twitter API key from Firebase:', error);
    // Fallback to environment variables
    BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || null;
    API_KEY = process.env.TWITTER_API_KEY || null;
    API_SECRET = process.env.TWITTER_API_SECRET || null;
    ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN || null;
    ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || null;
  }

  console.log("🔐 Twitter credentials check:", {
    BEARER_TOKEN: BEARER_TOKEN ? "✅ Present" : "❌ Missing",
    API_KEY: API_KEY ? "✅ Present" : "❌ Missing",
    API_SECRET: API_SECRET ? "✅ Present" : "❌ Missing",
    ACCESS_TOKEN: ACCESS_TOKEN ? "✅ Present" : "❌ Missing",
    ACCESS_TOKEN_SECRET: ACCESS_TOKEN_SECRET ? "✅ Present" : "❌ Missing",
  })

  if (!BEARER_TOKEN || !API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
    console.error("❌ Twitter API anahtarları eksik!")
    return { success: false, error: "Twitter API anahtarları eksik" };
  }

  // Validate that all credentials are valid strings
  if (typeof API_KEY !== 'string' || typeof API_SECRET !== 'string' ||
      typeof ACCESS_TOKEN !== 'string' || typeof ACCESS_TOKEN_SECRET !== 'string') {
    console.error('❌ Twitter credentials are not valid strings after decryption', {
      API_KEY: typeof API_KEY,
      API_SECRET: typeof API_SECRET,
      ACCESS_TOKEN: typeof ACCESS_TOKEN,
      ACCESS_TOKEN_SECRET: typeof ACCESS_TOKEN_SECRET
    })
    return { success: false, error: "Invalid Twitter API credentials format" };
  }

  // Build the final tweet FIRST before creating OAuth headers
  let bodyText = text

  // Add URL if not already included in text
  if (rawUrl && !urlAlreadyIncluded) {
    bodyText += '\n\n' + rawUrl
  }

  // Add hashtags if available
  if (finalHashtags.length > 0) {
    bodyText += '\n' + finalHashtags.join(' ')
  }

  // Final length check and log
  const finalLength = getTwitterCharacterCount(bodyText)
  if (finalLength > MAX_LENGTH) {
    console.warn(`⚠️ Tweet exceeds 280 characters: ${finalLength} chars. Content: "${bodyText.substring(0, 50)}..."`)
  }

  // Use twitter-api-v2 library (like Tweepy) for proper OAuth 1.0a handling
  try {
    console.log(`📤 Posting tweet to Twitter API v2 using TwitterApi library: "${bodyText.substring(0, 50)}..."`)

    // Create TwitterApi client with User Context (OAuth 1.0a)
    const userClient = new TwitterApi({
      appKey: API_KEY,
      appSecret: API_SECRET,
      accessToken: ACCESS_TOKEN,
      accessSecret: ACCESS_TOKEN_SECRET,
    });

    // Get read/write v2 client
    const v2Client = userClient.v2;

    console.log('📡 Sending tweet...')
    const result = await v2Client.tweet(bodyText);

    console.log(`✅ Tweet posted successfully!`)
    console.log('Tweet data:', result);

    const tweet_id = result.data.id;
    const tweet_url = `https://x.com/i/web/status/${tweet_id}`;

    // Record usage if we have a Twitter key ID
    if (TWITTER_KEY_ID) {
      try {
        await recordTwitterKeyUsage(TWITTER_KEY_ID);
      } catch (error) {
        console.error('Failed to record Twitter key usage:', error);
      }
    }

    return {
      success: true,
      tweet_id,
      url: tweet_url,
      hashtags: finalHashtags,
      finalLength: finalLength
    };
  } catch (error) {
    console.error('❌ Error posting tweet:', error);

    // Extract error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Object ? error : {};

    return {
      success: false,
      error: errorMessage,
      details: errorDetails
    };
  }
}
