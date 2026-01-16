/**
 * AI Caption Generation Service
 *
 * This module provides mock AI generation for development.
 * In production, this would call Firebase Cloud Functions with OpenAI.
 */

import { Timestamp } from 'firebase/firestore';
import type { Post, WorkspaceSettings } from '@/types';

export interface GenerationResult {
  facebook: {
    caption: string;
    hashtags: string[];
  };
  instagram: {
    caption: string;
    hashtags: string[];
  };
  confidence: number;
}

// Sample captions for different types of content
const SAMPLE_CAPTIONS = {
  facebook: [
    "Stop by today and treat yourself to something special! Our team is ready to make your day a little brighter.",
    "Nothing brings people together quite like good food and great company. Join us and make some memories!",
    "Looking for the perfect spot to unwind? We've got you covered. Come see what's on tap!",
    "Weekend plans? We've got you covered with delicious food and refreshing drinks. See you soon!",
    "There's always something brewing here. Pop in and discover your new favorite!",
  ],
  instagram: [
    "Your next favorite spot is waiting. Link in bio!",
    "Good vibes only. Tag someone who needs to see this!",
    "This is your sign to treat yourself today.",
    "Weekend mode: activated. Who's joining us?",
    "Made with love, served with a smile.",
  ],
};

const SAMPLE_HASHTAGS = {
  minimal: ['#localfood', '#supportlocal', '#foodie'],
  moderate: ['#localfood', '#supportlocal', '#foodie', '#yum', '#instafood', '#foodstagram', '#delicious'],
  heavy: ['#localfood', '#supportlocal', '#foodie', '#yum', '#instafood', '#foodstagram', '#delicious', '#foodporn', '#eeeeeats', '#foodgasm', '#tasty', '#nomnom', '#foodlover'],
};

/**
 * Generate AI captions for a post (mock implementation)
 */
export async function generateCaptions(
  starterText: string,
  settings: WorkspaceSettings['settings']['ai'],
  previousOutputs?: { fbCaption?: string; igCaption?: string }
): Promise<GenerationResult> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

  // Pick random captions
  const fbIndex = Math.floor(Math.random() * SAMPLE_CAPTIONS.facebook.length);
  const igIndex = Math.floor(Math.random() * SAMPLE_CAPTIONS.instagram.length);

  let fbCaption = SAMPLE_CAPTIONS.facebook[fbIndex];
  let igCaption = SAMPLE_CAPTIONS.instagram[igIndex];

  // If starter text provided, incorporate it
  if (starterText) {
    fbCaption = `${starterText}\n\n${fbCaption}`;
    igCaption = `${starterText}\n\n${igCaption}`;
  }

  // Add emojis based on style
  if (settings.emojiStyle === 'medium') {
    fbCaption = `🍺 ${fbCaption}`;
    igCaption = `✨ ${igCaption}`;
  } else if (settings.emojiStyle === 'high') {
    fbCaption = `🍺🎉 ${fbCaption} 🙌`;
    igCaption = `✨🔥 ${igCaption} 💯`;
  }

  // Get hashtags based on style
  const hashtags = [...SAMPLE_HASHTAGS[settings.hashtagStyle]];

  // Add some variation if regenerating
  if (previousOutputs) {
    // Shuffle hashtags for variation
    hashtags.sort(() => Math.random() - 0.5);
  }

  return {
    facebook: {
      caption: fbCaption,
      hashtags: hashtags.slice(0, settings.hashtagStyle === 'minimal' ? 3 : settings.hashtagStyle === 'moderate' ? 7 : 12),
    },
    instagram: {
      caption: igCaption,
      hashtags: hashtags.slice(0, settings.hashtagStyle === 'minimal' ? 4 : settings.hashtagStyle === 'moderate' ? 8 : 15),
    },
    confidence: 0.85 + Math.random() * 0.1,
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
