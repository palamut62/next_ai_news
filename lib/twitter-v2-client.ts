import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { generateHashtags } from './hashtag'

export async function postTextTweetV2(tweetText: string, sourceUrl?: string) {
  if (!tweetText || !tweetText.trim()) {
    return { success: false, error: "Tweet metni boş olamaz" };
  }
  let text = tweetText;
  // Generate up to 4 hashtags related to the content
  const hashtags = generateHashtags(text, 4)
  const hashtagsSuffix = hashtags.length ? '\n' + hashtags.join(' ') : ''

  // Prepare source URL suffix (bare URL). Only append if the content doesn't already include it.
  const rawUrl = sourceUrl && sourceUrl.trim() ? sourceUrl.trim() : ''
  let sourceSuffix = ''
  if (rawUrl && !text.includes(rawUrl)) {
    sourceSuffix = '\n' + rawUrl
  }

  const maxLen = 280

  // Reserve space for sourceSuffix and hashtagsSuffix and ellipsis
  const reserved = sourceSuffix.length + hashtagsSuffix.length
  if (text.length + reserved > maxLen) {
    const allowed = maxLen - reserved - 3 // for ...
    text = text.slice(0, Math.max(0, allowed)) + "..."
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

  const bodyText = text + sourceSuffix + hashtagsSuffix

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
    const tweet_url = `https://x.com/i/status/${tweet_id}`;
    return { success: true, tweet_id, url: tweet_url, hashtags };
  } else if (data.errors) {
    return { success: false, error: data.errors.map((e: any) => e.message).join(", "), details: data };
  } else {
    return { success: false, error: "Unknown Twitter API response: " + JSON.stringify(data), details: data };
  }
}
