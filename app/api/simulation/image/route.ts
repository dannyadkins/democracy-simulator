import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { headline, narration } = body;

    if (!headline || !narration) {
      return NextResponse.json(
        { error: 'headline and narration are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a prompt for Ghibli-style image
    const imagePrompt = `Studio Ghibli anime style illustration, whimsical and dreamlike: 

${headline}

Scene details: ${narration.slice(0, 300)}

Style: Soft watercolor textures, warm lighting, expressive characters, detailed backgrounds with a sense of wonder. Hayao Miyazaki inspired. Vibrant but gentle colors. Slightly exaggerated expressions showing the drama. Wide cinematic composition.`;

    console.log('🎨 Generating image for:', headline.slice(0, 50));

    const result = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      size: '1536x1024',
      quality: 'medium',
      n: 1,
    });

    // gpt-image-1 returns base64 by default
    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error('No image data returned');
    }

    console.log('✅ Image generated');

    // Return as data URL for direct use in img src
    return NextResponse.json({
      success: true,
      imageUrl: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
}
