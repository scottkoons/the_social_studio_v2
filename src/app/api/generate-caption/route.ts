import { NextRequest, NextResponse } from 'next/server';

interface GenerateRequest {
  starterText: string;
  brandVoice: string;
  hashtagStyle: 'minimal' | 'moderate' | 'heavy';
  emojiStyle: 'low' | 'medium' | 'high';
  platform: 'facebook' | 'instagram' | 'both';
}

interface PlatformContent {
  caption: string;
  hashtags: string[];
}

interface GenerateResponse {
  facebook?: PlatformContent;
  instagram?: PlatformContent;
  model: string;
}

const HASHTAG_COUNTS = {
  minimal: { facebook: 3, instagram: 5 },
  moderate: { facebook: 5, instagram: 10 },
  heavy: { facebook: 7, instagram: 15 },
};

const EMOJI_GUIDANCE = {
  low: 'Use no emojis or at most 1 emoji.',
  medium: 'Use 2-3 emojis strategically placed.',
  high: 'Use 4-6 emojis throughout the caption for energy and visual appeal.',
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body: GenerateRequest = await request.json();
    const { starterText, brandVoice, hashtagStyle, emojiStyle, platform } = body;

    if (!starterText) {
      return NextResponse.json(
        { error: 'starterText is required' },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(brandVoice, hashtagStyle, emojiStyle);
    const userPrompt = buildUserPrompt(starterText, platform, hashtagStyle);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate content', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No content generated' },
        { status: 500 }
      );
    }

    const parsed = parseAIResponse(content, platform, hashtagStyle);

    return NextResponse.json({
      ...parsed,
      model: 'gpt-4o-mini',
    } as GenerateResponse);

  } catch (error) {
    console.error('Generate caption error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(
  brandVoice: string,
  hashtagStyle: string,
  emojiStyle: string
): string {
  return `You are a social media expert for restaurants and local businesses. You create engaging, authentic captions that drive engagement.

BRAND VOICE:
${brandVoice || 'Friendly, welcoming, and community-focused. Casual but professional.'}

EMOJI STYLE:
${EMOJI_GUIDANCE[emojiStyle as keyof typeof EMOJI_GUIDANCE]}

GUIDELINES:
- Write conversational, authentic copy that doesn't sound like AI
- Focus on creating connection and community
- Include clear calls-to-action when appropriate
- Never use clichés like "dive into" or "elevate your experience"
- Keep Facebook posts slightly longer and more conversational
- Keep Instagram posts punchy and visual-focused
- Hashtags should be relevant to restaurants, food, local business, and the specific content

RESPONSE FORMAT:
You must respond in this exact JSON format:
{
  "facebook": {
    "caption": "Your Facebook caption here",
    "hashtags": ["#hashtag1", "#hashtag2"]
  },
  "instagram": {
    "caption": "Your Instagram caption here",
    "hashtags": ["#hashtag1", "#hashtag2"]
  }
}`;
}

function buildUserPrompt(
  starterText: string,
  platform: string,
  hashtagStyle: string
): string {
  const fbCount = HASHTAG_COUNTS[hashtagStyle as keyof typeof HASHTAG_COUNTS].facebook;
  const igCount = HASHTAG_COUNTS[hashtagStyle as keyof typeof HASHTAG_COUNTS].instagram;

  return `Create social media captions based on this content idea:

"${starterText}"

Requirements:
- Facebook: Engaging caption with exactly ${fbCount} relevant hashtags
- Instagram: Punchy caption with exactly ${igCount} relevant hashtags
- Both captions should be unique but convey the same message
- Hashtags should be a mix of broad reach (#foodie, #localfood) and specific (#restaurantlife, #supportlocal)

Generate the captions now in the specified JSON format.`;
}

function parseAIResponse(
  content: string,
  platform: string,
  hashtagStyle: string
): { facebook?: PlatformContent; instagram?: PlatformContent } {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result: { facebook?: PlatformContent; instagram?: PlatformContent } = {};

    if (parsed.facebook && (platform === 'facebook' || platform === 'both')) {
      result.facebook = {
        caption: parsed.facebook.caption || '',
        hashtags: Array.isArray(parsed.facebook.hashtags)
          ? parsed.facebook.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`)
          : [],
      };
    }

    if (parsed.instagram && (platform === 'instagram' || platform === 'both')) {
      result.instagram = {
        caption: parsed.instagram.caption || '',
        hashtags: Array.isArray(parsed.instagram.hashtags)
          ? parsed.instagram.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`)
          : [],
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to parse AI response:', error, content);
    // Return fallback content
    return {
      facebook: {
        caption: content.slice(0, 500),
        hashtags: ['#localfood', '#supportlocal', '#foodie'],
      },
      instagram: {
        caption: content.slice(0, 300),
        hashtags: ['#food', '#foodie', '#instafood', '#yum', '#delicious'],
      },
    };
  }
}
