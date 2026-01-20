/**
 * AI Caption Generation Service
 *
 * This module calls the server-side API route that interfaces with OpenAI
 * to generate social media captions and hashtags.
 */

import type { WorkspaceSettings } from '@/types';

export interface GenerationResult {
  facebook: {
    caption: string;
    hashtags: string[];
  };
  instagram: {
    caption: string;
    hashtags: string[];
  };
  model: string;
  confidence: number;
}

/**
 * Generate AI captions for a post using OpenAI
 */
export async function generateCaptions(
  starterText: string,
  settings: WorkspaceSettings['settings']['ai'],
  _previousOutputs?: { fbCaption?: string; igCaption?: string }
): Promise<GenerationResult> {
  const response = await fetch('/api/generate-caption', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      starterText,
      brandVoice: settings.brandVoice,
      hashtagStyle: settings.hashtagStyle,
      emojiStyle: settings.emojiStyle,
      platform: 'both',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to generate captions');
  }

  const data = await response.json();

  return {
    facebook: data.facebook || { caption: '', hashtags: [] },
    instagram: data.instagram || { caption: '', hashtags: [] },
    model: data.model || 'gpt-4o-mini',
    confidence: 0.95,
  };
}

/**
 * Build the full caption with hashtags
 */
export function buildFullCaption(caption: string, hashtags: string[]): string {
  if (hashtags.length === 0) return caption;
  return `${caption}\n\n${hashtags.join(' ')}`;
}

/**
 * Parse hashtags from a caption string
 */
export function parseHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  return matches || [];
}

/**
 * Remove hashtags from a caption string
 */
export function removeHashtags(text: string): string {
  return text
    .replace(/#\w+/g, '')
    .replace(/\n\n\s*$/g, '')
    .trim();
}
