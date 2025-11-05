import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Counts the actual character length of a string as Twitter counts it.
 * Uses Intl.Segmenter for proper Unicode handling (emojis, diacritics, etc.)
 * Falls back to length property if Segmenter is not available.
 */
export function getTwitterCharacterCount(text: string): number {
  if (!text) return 0

  try {
    // Use Intl.Segmenter for proper grapheme counting (handles emojis correctly)
    // @ts-ignore - Segmenter is not in all TypeScript versions
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      // @ts-ignore
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      const segments = Array.from(segmenter.segment(text))
      return segments.length
    }
  } catch (e) {
    // Fallback if Segmenter is not available
  }

  // Fallback: Count UTF-16 code units (closest to Twitter's method)
  // This counts emojis as 2 characters, which is closer to Twitter's actual count
  let count = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    // Emoji range detection - these take 2 UTF-16 code units
    if (code >= 0xD800 && code <= 0xDBFF) {
      count += 2 // High surrogate (emoji)
      i++ // Skip next char (low surrogate)
    } else {
      count += 1
    }
  }
  return count
}

/**
 * Truncates text to fit within maxCharacters using proper character counting
 */
export function truncateToCharacterLimit(
  text: string,
  maxCharacters: number,
  suffix: string = "..."
): string {
  if (getTwitterCharacterCount(text) <= maxCharacters) {
    return text
  }

  // Reserve space for suffix
  const maxContent = maxCharacters - getTwitterCharacterCount(suffix)
  if (maxContent <= 0) return ""

  let truncated = ""
  let count = 0

  try {
    // @ts-ignore
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      // @ts-ignore
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      // @ts-ignore
      for (const segment of segmenter.segment(text)) {
        count += 1 // Each grapheme counts as 1
        if (count > maxContent) break
        truncated += segment.segment
      }
    } else {
      // Fallback: use basic truncation
      truncated = text.substring(0, Math.min(text.length, maxContent))
    }
  } catch (e) {
    truncated = text.substring(0, Math.min(text.length, maxContent))
  }

  return truncated + suffix
}

/**
 * Calculates how many characters remain for content given reserved space
 */
export function calculateRemainingCharacters(
  reservedCharacters: number,
  maxLimit: number = 280
): number {
  return Math.max(0, maxLimit - reservedCharacters)
}

/**
 * Estimates the total character count for a tweet with content, URL, and hashtags
 */
export function estimateTotalTweetLength(
  content: string,
  url?: string,
  hashtags?: string[]
): number {
  let total = getTwitterCharacterCount(content)

  if (url) {
    total += 2 // newlines: \n\n
    total += getTwitterCharacterCount(url)
  }

  if (hashtags && hashtags.length > 0) {
    total += 1 // newline: \n
    hashtags.forEach((tag) => {
      total += getTwitterCharacterCount(tag) + 1 // tag + space
    })
  }

  return total
}

/**
 * Validates if a complete tweet stays within Twitter's 280 character limit
 */
export function validateTweetLength(
  content: string,
  url?: string,
  hashtags?: string[]
): { valid: boolean; length: number; remaining: number } {
  const length = estimateTotalTweetLength(content, url, hashtags)
  const remaining = 280 - length

  return {
    valid: length <= 280,
    length,
    remaining: Math.max(0, remaining)
  }
}
