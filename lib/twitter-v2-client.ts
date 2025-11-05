import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { getTwitterCharacterCount, estimateTotalTweetLength } from './utils'

export async function postTextTweetV2(
  tweetText: string,
  sourceUrl?: string,
  hashtags?: string[]
) {
  if (!tweetText || !tweetText.trim()) {
    return { success: false, error: "Tweet metni boş olamaz" };
  }

  let text = tweetText.trim()
  const MAX_LENGTH = 280

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
  const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
  const API_KEY = process.env.TWITTER_API_KEY;
  const API_SECRET = process.env.TWITTER_API_SECRET;
  const ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
  const ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!BEARER_TOKEN || !API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
    return { success: false, error: "Twitter API anahtarları eksik" };
  }

  const oauth = new OAuth({
    consumer: { key: API_KEY, secret: API_SECRET },
    signature_method: "HMAC-SHA1",
    hash_function(base_string: string, key: string) {
      return crypto.createHmac("sha1", key).update(base_string).digest("base64");
    },
  });

  const request_data = {
    url: "https://api.twitter.com/2/tweets",
    method: "POST",
    data: {},
  };

  const token = {
    key: ACCESS_TOKEN,
    secret: ACCESS_TOKEN_SECRET,
  };

  const headers = {
    ...oauth.toHeader(oauth.authorize(request_data, token)),
    "Content-Type": "application/json",
  };

  // Build the final tweet
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

  const response = await fetch(request_data.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: bodyText }),
  });

  const status = response.status
  const statusText = response.statusText
  let rawText: string | null = null
  try {
    rawText = await response.text()
  } catch (e) {
    rawText = null
  }
  let data: any = null
  try {
    data = rawText ? JSON.parse(rawText) : null
  } catch (e) {
    data = null
  }

  console.log("Twitter API response status:", status, statusText)
  console.log("Twitter API raw response:", rawText)

  if (data.data && data.data.id) {
    const tweet_id = data.data.id;
    const tweet_url = `https://x.com/i/web/status/${tweet_id}`;
    console.log(`✅ Tweet posted successfully: ${tweet_url}`)
    return {
      success: true,
      tweet_id,
      url: tweet_url,
      hashtags: finalHashtags,
      finalLength: finalLength
    };
  } else if (data.errors) {
    console.error(`❌ Twitter API error: ${data.errors.map((e: any) => e.message).join(", ")}`)
    return { success: false, error: data.errors.map((e: any) => e.message).join(", "), details: data };
  } else {
    console.error(`❌ Unknown Twitter API response: ${JSON.stringify(data)}`)
    return { success: false, error: "Unknown Twitter API response: " + JSON.stringify(data), details: data };
  }
}
